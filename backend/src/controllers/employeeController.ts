import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  uuidParamSchema,
} from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import { sendEmployeeAccessCode } from '@services/whatsappService';
import { invalidateWhatsAppCache } from '@services/whatsappService';
import { getFinancialSummary } from '@services/financialService';
import { persistImage, removeImage } from '@services/uploadService';
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';

function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Rótulos de campo, para o log falar português.
 *
 * O log grava a chave da coluna e a tela mostra isto. Sem a translation, quem lê
 * "specialties" num registro de alteração não entende o que mudou — e o ponto
 * de um log é ser lido por gente, não por quem escreveu a query.
 */
const CABELHO: Record<string, string> = {
  name: 'o nome',
  phone: 'o telefone',
  specialties: 'os serviços',
  isActive: 'a situação',
  accessCode: 'o código de acesso',
  email: 'o e-mail',
};

/**
 * Monta a lista de campos que mudaram, lendo o estado anterior.
 *
 * Sem o "antes", o log só diria "alterou o profissional" — e a pergunta real,
 * um mês depois, é sempre o que mudou de verdade. Uma troca de telefone e uma
 * mudança de nome produzem a mesma linha, e uma delas é séria.
 */
function oQueMudou(antes: Record<string, unknown> | null, depois: Record<string, unknown>) {
  if (!antes) return { campos: [] as string[], detalhe: null };

  const campos: string[] = [];
  const detalhe: Record<string, { de: unknown; para: unknown }> = {};

  for (const [chave, para] of Object.entries(depois)) {
    const de = antes[chave];
    if (de === para) continue;
    if (!(chave in CABELHO)) continue;
    campos.push(CABELHO[chave]);
    detalhe[chave] = { de: de ?? null, para: para ?? null };
  }

  return { campos, detalhe };
}

/** Só os campos que interessam para comparar; `select` do Prisma limita o resto. */
const CAMPOS_COMPARADOS = {
  name: true,
  phone: true,
  specialties: true,
  isActive: true,
} as const;

/**
 * GET /owner/employees
 * Lista funcionários (owner)
 */
export async function getEmployees(req: AuthRequest, res: Response): Promise<void> {
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
      _count: {
        select: { appointments: true },
      },
    },
  });

  // Busca serviços de cada funcionário
  const employeesWithServices = await Promise.all(
    employees.map(async (emp) => {
      const services = await prisma.service.findMany({
        where: {
          appointments: {
            some: { employeeId: emp.id },
          },
        },
        select: { id: true, name: true },
      });
      return { ...emp, services };
    })
  );

  res.json({ employees: employeesWithServices });
}

/**
 * GET /employees/active
 * Lista funcionários ativos com especialidades (público para agendamento)
 */
export async function getActiveEmployees(req: AuthRequest, res: Response): Promise<void> {
  const employees = await prisma.user.findMany({
    // inclui o OWNER: ele também atende e precisa aparecer na lista
    where: { role: { in: ['EMPLOYEE', 'OWNER'] }, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      specialties: true,
      // o cliente vê a foto de quem vai atendê-lo
      photoUrl: true,
      _count: {
        select: { appointments: true },
      },
    },
  });

  res.json({ employees });
}

/**
 * POST /owner/employees
 * Cria funcionário (owner)
 */
export async function createEmployee(req: AuthRequest, res: Response): Promise<void> {
  const { name, phone, specialties } = req.body;

  // Verifica se telefone já existe
  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) {
    await audit.record(
      {
        action: AuditAction.EMPLOYEE_CREATED,
        summary: `Tentou cadastrar um profissional com o telefone de ${existingPhone.name}, que já existe`,
        entity: 'employee',
        outcome: 'FAILURE',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { telefone: phone },
      },
      audit.auditContextFrom(req)
    );
    throw new AppError('Telefone já cadastrado', 409, 'PHONE_EXISTS');
  }

  const accessCode = generateAccessCode();

  // Verifica se código já existe (improvável mas seguro)
  let codeExists = await prisma.user.findUnique({ where: { accessCode } });
  while (codeExists) {
    const newCode = generateAccessCode();
    codeExists = await prisma.user.findUnique({ where: { accessCode: newCode } });
  }

  const employee = await prisma.user.create({
    data: {
      name,
      phone,
      specialties,
      accessCode,
      role: 'EMPLOYEE',
      isActive: true,
    },
  });

  // Os serviços que o funcionário realiza ficam no campo `specialties`.

  // Envia código por WhatsApp (se configurado)
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  if (settings) {
    await sendEmployeeAccessCode(phone, name, accessCode, settings.name);
  }

  /**
   * O código de acesso NÃO entra no registro.
   *
   * Ele é a senha do profissional: quem o tiver entra na agenda e no financeiro
   * dele. Um log com o código seria uma senha guardada em texto numa tabela que
   * todo mundo com acesso ao banco consegue ler — e o log justamente existe para
   * ser lido por mais gente que a agenda.
   */
  await audit.record(
    {
      action: AuditAction.EMPLOYEE_CREATED,
      summary: `Cadastrou o profissional ${name}`,
      entity: 'employee',
      entityId: employee.id,
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
      metadata: { telefone: phone, servicos: specialties ?? [], codigoEnviado: Boolean(settings) },
    },
    audit.auditContextFrom(req)
  );

  res.status(201).json({
    employee: {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      specialties: employee.specialties,
      accessCode: employee.accessCode,
      isActive: employee.isActive,
    },
  });
}

/**
 * GET /owner/employees/:id
 * Busca funcionário por ID (owner)
 */
export async function getEmployeeById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const employee = await prisma.user.findUnique({
    where: { id, role: 'EMPLOYEE' },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!employee) {
    throw new AppError('Funcionário não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
  }

  res.json({ employee });
}

/**
 * PATCH /owner/employees/:id
 * Atualiza funcionário (owner)
 */
export async function updateEmployee(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  // Se está mudando telefone, verifica duplicata
  if (data.phone) {
    const existing = await prisma.user.findFirst({
      where: { phone: data.phone, NOT: { id } },
    });
    if (existing) {
      await audit.record(
        {
          action: AuditAction.EMPLOYEE_UPDATED,
          summary: `Tentou usar o telefone de ${existing.name}, que já pertence a outro cadastro`,
          entity: 'employee',
          entityId: id,
          outcome: 'FAILURE',
          actorKind: 'OWNER',
          actorId: req.user?.sub ?? null,
          metadata: { telefoneTentado: data.phone },
        },
        audit.auditContextFrom(req)
      );
      throw new AppError('Telefone já cadastrado', 409, 'PHONE_EXISTS');
    }
  }

  const antes = await prisma.user.findUnique({
    where: { id, role: 'EMPLOYEE' },
    select: CAMPOS_COMPARADOS,
  });

  const employee = await prisma.user.update({
    where: { id, role: 'EMPLOYEE' },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
    },
  });

  // Invalida cache WhatsApp se config mudou
  invalidateWhatsAppCache();

  const { campos, detalhe } = oQueMudou(antes, employee);

  if (campos.length > 0) {
    await audit.record(
      {
        action: AuditAction.EMPLOYEE_UPDATED,
        summary: `Alterou ${campos.join(', ')} de ${employee.name}`,
        entity: 'employee',
        entityId: id,
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { alteracoes: detalhe },
      },
      audit.auditContextFrom(req)
    );
  }

  res.json({ employee });
}

/**
 * POST /owner/employees/:id/regenerate-code
 * Regenera código de acesso do funcionário
 */
export async function regenerateAccessCode(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const newAccessCode = generateAccessCode();

  const employee = await prisma.user.update({
    where: { id, role: 'EMPLOYEE' },
    data: { accessCode: newAccessCode },
    select: { id: true, name: true, phone: true, accessCode: true },
  });

  // Envia novo código por WhatsApp
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  if (settings) {
    await sendEmployeeAccessCode(employee.phone, employee.name, newAccessCode, settings.name);
  }

  /**
   * Trocar o código é a resposta para "perdi o acesso" e também para
   * "alguém está entrando na minha conta". O registro precisa dizer qual dos dois
   * foi — e o que decide isso é o motivo, que o dono informa.
   *
   * O código novo, como o antigo, não entra: só o fato de ter sido trocado.
   */
  await audit.record(
    {
      action: AuditAction.EMPLOYEE_ACCESS_CODE_REGENERATED,
      summary: `Gerou novo código de acesso de ${employee.name}`,
      entity: 'employee',
      entityId: id,
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
      metadata: { motivo: req.body?.motivo ?? null, codigoEnviado: Boolean(settings) },
    },
    audit.auditContextFrom(req)
  );

  res.json({ employee });
}

/**
 * DELETE /owner/employees/:id
 * Desativa funcionário (owner) - soft delete
 */
export async function deleteEmployee(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // Verifica agendamentos futuros
  const futureAppointments = await prisma.appointment.count({
    where: {
      employeeId: id,
      status: 'SCHEDULED',
      startsAt: { gte: new Date() },
    },
  });

  if (futureAppointments > 0) {
    const alvo = await prisma.user.findUnique({
      where: { id, role: 'EMPLOYEE' },
      select: { name: true },
    });

    await audit.record(
      {
        action: AuditAction.EMPLOYEE_DELETED,
        summary: `Tentou desativar ${alvo?.name ?? 'um profissional'} com ${futureAppointments} agendamento(s) futuro(s)`,
        entity: 'employee',
        entityId: id,
        outcome: 'FAILURE',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { agendamentosFuturos: futureAppointments },
      },
      audit.auditContextFrom(req)
    );

    throw new AppError(
      'Não é possível desativar funcionário com agendamentos futuros',
      400,
      'HAS_FUTURE_APPOINTMENTS'
    );
  }

  const desativado = await prisma.user.update({
    where: { id, role: 'EMPLOYEE' },
    data: { isActive: false },
    select: { name: true },
  });

  await audit.record(
    {
      action: AuditAction.EMPLOYEE_DELETED,
      summary: `Desativou o profissional ${desativado.name}`,
      entity: 'employee',
      entityId: id,
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
    },
    audit.auditContextFrom(req)
  );

  res.json({ message: 'Funcionário desativado com sucesso' });
}

/**
 * GET /employee/profile
 * Perfil do funcionário logado
 */
export async function getEmployeeProfile(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const employee = await prisma.user.findUnique({
    where: { id: entity.id },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}

/**
 * PATCH /employee/photo
 * O próprio funcionário envia a foto do rosto.
 */
export async function uploadMyPhoto(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const file = req.file;
  if (!file) {
    throw new AppError('Envie um arquivo de imagem', 400, 'FILE_REQUIRED');
  }

  const current = await prisma.user.findUnique({
    where: { id: entity.id },
    select: { photoUrl: true },
  });

  const photoUrl = await persistImage(file.buffer, 'employees', entity.id, file.mimetype);

  /**
   * A anterior só é removida DEPOIS que a nova está guardada.
   *
   * A ordem é o que evita a foto sumir. Remover primeiro deixaria uma janela em
   * que não há foto nenhuma — e se a gravação da nova falhasse depois, o
   * profissional ficaria sem imagem até o próximo envio, sem nenhuma pista de
   * que houve troca.
   */
  await removeImage(current?.photoUrl);

  const employee = await prisma.user.update({
    where: { id: entity.id },
    data: { photoUrl },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  // A foto é o que o cliente vê antes de marcar. Trocá-la é uma ação de
  // confiança — e o log precisa dizer se foi o próprio profissional ou o dono,
  // porque são situações bem diferentes.
  await audit.record(
    {
      action: AuditAction.EMPLOYEE_PHOTO_CHANGED,
      summary: 'Trocou a própria foto',
      entity: 'employee',
      entityId: entity.id,
      actorKind: 'EMPLOYEE',
      actorId: entity.id,
      actorLabel: employee.name,
      metadata: { trocou: Boolean(current?.photoUrl) },
    },
    audit.auditContextFrom(req)
  );

  res.json({ employee });
}

/**
 * DELETE /employee/photo
 */
export async function removeMyPhoto(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const current = await prisma.user.findUnique({
    where: { id: entity.id },
    select: { photoUrl: true, name: true },
  });

  await removeImage(current?.photoUrl);

  const employee = await prisma.user.update({
    where: { id: entity.id },
    data: { photoUrl: null },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  await audit.record(
    {
      action: AuditAction.EMPLOYEE_PHOTO_CHANGED,
      summary: 'Removeu a própria foto',
      entity: 'employee',
      entityId: entity.id,
      actorKind: 'EMPLOYEE',
      actorId: entity.id,
      actorLabel: employee.name,
    },
    audit.auditContextFrom(req)
  );

  res.json({ employee });
}

/**
 * PATCH /owner/employees/:id/photo
 * O dono envia a foto de um funcionário.
 */
export async function uploadEmployeePhoto(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError('Envie um arquivo de imagem', 400, 'FILE_REQUIRED');
  }

  const { id } = req.params;
  const current = await prisma.user.findUnique({
    where: { id },
    select: { photoUrl: true },
  });

  if (!current) {
    // A imagem chegou mas não há a quem pertence. Guardar e apagar logo em
    // seguida deixaria um arquivo órfão no Storage, ocupando bytes para sempre
    // — sem ninguém apontando para ele e sem forma de limpá-lo depois.
    await removeImage(await persistImage(file.buffer, 'employees', id, file.mimetype));
    throw new AppError('Funcionário não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
  }

  const photoUrl = await persistImage(file.buffer, 'employees', id, file.mimetype);
  await removeImage(current.photoUrl);

  const employee = await prisma.user.update({
    where: { id },
    data: { photoUrl },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  await audit.record(
    {
      action: AuditAction.EMPLOYEE_PHOTO_CHANGED,
      summary: `Trocou a foto de ${employee.name}`,
      entity: 'employee',
      entityId: id,
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
      metadata: { trocou: Boolean(current.photoUrl) },
    },
    audit.auditContextFrom(req)
  );

  res.json({ employee });
}

/**
 * DELETE /owner/employees/:id/photo
 * O dono remove a foto de um funcionário (volta para a inicial).
 */
export async function removeEmployeePhoto(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const current = await prisma.user.findUnique({
    where: { id },
    select: { photoUrl: true },
  });

  if (!current) {
    throw new AppError('Funcionário não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
  }

  await removeImage(current.photoUrl);

  const employee = await prisma.user.update({
    where: { id },
    data: { photoUrl: null },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  await audit.record(
    {
      action: AuditAction.EMPLOYEE_PHOTO_CHANGED,
      summary: `Removeu a foto de ${employee.name}`,
      entity: 'employee',
      entityId: id,
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
    },
    audit.auditContextFrom(req)
  );

  res.json({ employee });
}

/**
 * GET /employee/financial
 * Controle financeiro do PRÓPRIO funcionário (dia / mês / ano).
 * O employeeId vem sempre do token — nunca da query — para que um
 * funcionário não consiga ver o faturamento de outro.
 */
export async function getMyFinancials(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const { period = 'month', reference } = req.query as {
    period?: 'day' | 'month' | 'year';
    /** 'YYYY-MM-DD' crua: a conversão para o fuso do salão é do serviço. */
    reference?: string;
  };

  const summary = await getFinancialSummary(entity.id, period, reference);

  res.json({ financial: summary });
}