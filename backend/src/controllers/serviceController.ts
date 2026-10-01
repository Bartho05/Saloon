import { Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import {
  createServiceSchema,
  updateServiceSchema,
  uuidParamSchema,
  listAppointmentsSchema,
} from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';

/**
 * O dono é a única pessoa que mexe no cardápio, então toda escrita aqui é dele.
 *
 * Helper em vez de repetir o mesmo bloco três vezes: se o `actorKind` ficasse
 * implícito em cada chamada, um deles acabaria marcando `ANONYMOUS` e o log
 * mostraria uma alteração de preço vinda de lugar nenhum.
 */
async function registraDono(
  req: AuthRequest,
  action: Parameters<typeof audit.record>[0]['action'],
  summary: string,
  entityId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await audit.record(
    {
      action,
      summary,
      entity: 'service',
      entityId: entityId ?? null,
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
      metadata: metadata ?? null,
    },
    audit.auditContextFrom(req)
  );
}

/**
 * Campos que mudam o que o cliente vê e o que o profissional fatura.
 *
 * O log guarda o antes e o depois porque a pergunta que aparece um mês depois é
 * sempre "a que preço eu vendi aquele serviço?", e o valor atual não responde.
 */
function diferencaDoServico(antes: Record<string, unknown>, depois: Record<string, unknown>) {
  const mudou: Record<string, { de: unknown; para: unknown }> = {};

  for (const campo of ['name', 'price', 'durationMinutes', 'description', 'isActive'] as const) {
    const de = antes[campo];
    const para = depois[campo];
    if (de !== para) mudou[campo] = { de: de ?? null, para: para ?? null };
  }

  return mudou;
}

/**
 * GET /services
 * Lista serviços ativos (público)
 */
export async function getServices(req: AuthRequest, res: Response): Promise<void> {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      price: true,
    },
  });

  res.json({ services });
}

/**
 * GET /services/:id
 * Busca serviço por ID (público)
 */
export async function getServiceById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const service = await prisma.service.findUnique({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      price: true,
    },
  });

  if (!service) {
    throw new AppError('Serviço não encontrado', 404, 'SERVICE_NOT_FOUND');
  }

  res.json({ service });
}

/**
 * POST /owner/services
 * Cria novo serviço (owner)
 */
export async function createService(req: AuthRequest, res: Response): Promise<void> {
  const { name, description, durationMinutes, price } = req.body;

  const service = await prisma.service.create({
    data: {
      name,
      description,
      durationMinutes,
      price,
    },
  });

  await registraDono(
    req,
    AuditAction.SERVICE_CREATED,
    `Cadastrou o serviço ${service.name} (${service.durationMinutes} min)`,
    service.id,
    { preco: service.price, duracao: service.durationMinutes }
  );

  res.status(201).json({ service });
}

/**
 * PATCH /owner/services/:id
 * Atualiza serviço (owner)
 */
export async function updateService(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  // Lê o estado atual antes de gravar: sem o "antes", o log só diria "alterou".
  const antes = await prisma.service.findUnique({
    where: { id },
    select: { name: true, price: true, durationMinutes: true, description: true, isActive: true },
  });

  const service = await prisma.service.update({
    where: { id },
    data,
  });

  const mudou = antes
    ? diferencaDoServico(antes as Record<string, unknown>, service as Record<string, unknown>)
    : {};

  if (Object.keys(mudou).length > 0) {
    const campos = Object.keys(mudou)
      .map((c) => CABELHO_DE_SERVICO[c] ?? c)
      .join(', ');
    await registraDono(req, AuditAction.SERVICE_UPDATED, `Alterou ${campos} em ${service.name}`, id, {
      alteracoes: mudou,
    });
  }

  res.json({ service });
}

/** Rótulos em português, para o log não vazar nome de coluna. */
const CABELHO_DE_SERVICO: Record<string, string> = {
  name: 'o nome',
  price: 'o preço',
  durationMinutes: 'a duração',
  description: 'a descrição',
  isActive: 'a visibilidade',
};

/**
 * DELETE /owner/services/:id
 * Desativa serviço (owner) - soft delete
 */
export async function deleteService(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // Verifica se tem agendamentos futuros
  const futureAppointments = await prisma.appointment.count({
    where: {
      serviceId: id,
      status: 'SCHEDULED',
      startsAt: { gte: new Date() },
    },
  });

  if (futureAppointments > 0) {
    await audit.record(
      {
        action: AuditAction.SERVICE_DELETED,
        summary: `Tentou desativar um serviço com ${futureAppointments} agendamento(s) futuro(s)`,
        entity: 'service',
        entityId: id,
        outcome: 'FAILURE',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { agendamentosFuturos: futureAppointments },
      },
      audit.auditContextFrom(req)
    );
    throw new AppError(
      'Não é possível desativar serviço com agendamentos futuros',
      400,
      'HAS_FUTURE_APPOINTMENTS'
    );
  }

  const desativado = await prisma.service.update({
    where: { id },
    data: { isActive: false },
  });

  await registraDono(
    req,
    AuditAction.SERVICE_DELETED,
    `Desativou o serviço ${desativado.name}`,
    id
  );

  res.json({ message: 'Serviço desativado com sucesso' });
}

/**
 * GET /owner/services
 * Lista todos os serviços (incluindo inativos) para owner
 */
export async function getAllServices(req: AuthRequest, res: Response): Promise<void> {
  const services = await prisma.service.findMany({
    orderBy: { name: 'asc' },
  });

  res.json({ services });
}