import { Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import {
  checkClientSchema,
  getSlotsSchema,
  createBookingSchema,
  cancelBookingSchema,
} from '@utils/validation';
import {
  getAvailableSlots,
  createBooking,
  cancelBooking,
} from '@services/scheduleService';
import { AppError } from '@middlewares/errorHandler';
import { notifyOwnerNewBooking, sendAppointmentConfirmation } from '@services/whatsappService';
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';

/**
 * POST /booking/check-client
 * Verifica se cliente existe pelo telefone
 */
export async function checkClient(req: AuthRequest, res: Response): Promise<void> {
  const { phone } = req.body;

  const client = await prisma.client.findUnique({
    where: { phone },
    select: {
      id: true,
      fullName: true,
      phone: true,
      birthDate: true,
      createdAt: true,
    },
  });

  if (client) {
    res.json({
      exists: true,
      client: {
        ...client,
        // null = cadastro iniciado mas ainda sem data de nascimento
        birthDate: client.birthDate ? client.birthDate.toISOString().split('T')[0] : null,
      },
    });
  } else {
    res.json({ exists: false });
  }
}

/**
 * GET /booking/slots
 * Busca horários disponíveis para agendamento
 */
export async function getSlots(req: AuthRequest, res: Response): Promise<void> {
  const { employeeId, serviceId, date } = req.query as {
    employeeId: string;
    serviceId: string;
    date: string;
  };

  const selectedDate = new Date(date + 'T00:00:00');

  const result = await getAvailableSlots(employeeId, serviceId, selectedDate);

  if (result.blockedReason) {
    res.json({
      slots: [],
      grouped: {},
      blocked: true,
      reason: result.blockedReason,
    });
    return;
  }

  res.json({
    slots: result.slots,
    grouped: result.grouped,
    blocked: false,
  });
}

/**
 * POST /booking/create
 * Cria agendamento (find-or-create client)
 */
export async function createBookingController(req: AuthRequest, res: Response): Promise<void> {
  const { serviceId, employeeId, startsAt, client } = req.body;

  /**
   * A tentativa recusada é registrada tanto quanto a aceita.
   *
   * Esta é a linha que mais importa no log inteiro: quando um cliente diz "aquele
   * horário estava livre" e não estava, a única prova do que aconteceu está
   * aqui — o horário pedido, o profissional escolhido e o motivo da recusa.
   * Sem isso o log só contaria as aulas que deram certo, que é o que a agenda já
   * mostra sozinha.
   */
  let result;
  try {
    result = await createBooking({
      serviceId,
      employeeId,
      startsAt: new Date(startsAt),
      client,
    });
  } catch (err) {
    const appErr = err as AppError;
    await audit.record(
      {
        action: AuditAction.APPOINTMENT_REJECTED,
        summary: `Agendamento recusado: ${appErr.message || 'erro desconhecido'}`,
        entity: 'appointment',
        outcome: 'FAILURE',
        actorKind: 'CLIENT',
        actorLabel: client?.fullName?.trim() || client?.phone || null,
        metadata: {
          serviceId,
          employeeId,
          quando: startsAt,
          telefone: client?.phone,
          motivo: appErr.code,
        },
      },
      audit.auditContextFrom(req)
    );
    throw err;
  }

  await audit.record(
    {
      action: AuditAction.APPOINTMENT_CREATED,
      summary: `Agendou ${result.appointment.service.name} com ${result.appointment.employee.name}`,
      entity: 'appointment',
      entityId: result.appointment.id,
      actorKind: 'CLIENT',
      actorId: result.client.id,
      actorLabel: result.client.fullName,
      metadata: {
        serviceId,
        employeeId,
        quando: result.appointment.startsAt.toISOString(),
        telefone: result.client.phone,
        clienteNovo: result.isNewClient,
      },
    },
    audit.auditContextFrom(req)
  );

  // Notifica dono sobre novo agendamento
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  const formattedDate = new Date(startsAt).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  /**
   * Confirmação para o CLIENTE.
   *
   * Esta mensagem faltava, e a falta é do tipo que só aparece com uso real: o
   * site promete "você receberá confirmação e um lembrete", mas a confirmação
   * só saía quando o atendimento era marcado como CONCLUÍDO — ou seja, no fim.
   * O cliente terminava o agendamento sem nenhuma confirmação, e ficava na
   * dúvida se tinha dado certo.
   *
   * O que resolve não é a mensagem em si: é que o cliente recebe o código de
   * verificação logo antes, e espera a confirmação logo depois. Sem ela, ele
   * não sabe se o agendamento entrou.
   */
  if (settings) {
    const enviada = await sendAppointmentConfirmation({
      clientName: result.client.fullName,
      clientPhone: result.client.phone,
      serviceName: result.appointment.service.name,
      employeeName: result.appointment.employee.name,
      dateTime: formattedDate,
      salonName: settings.name,
    });

    void audit.record(
      {
        action: enviada ? AuditAction.WHATSAPP_SENT : AuditAction.WHATSAPP_FAILED,
        summary: enviada
          ? `Enviou a confirmação do agendamento para ${result.client.fullName}`
          : `Não foi possível enviar a confirmação para ${result.client.fullName}`,
        entity: 'whatsapp',
        outcome: enviada ? 'SUCCESS' : 'FAILURE',
        actorKind: 'SYSTEM',
        metadata: { telefone: result.client.phone, uso: 'confirmacao de agendamento' },
      },
      audit.auditContextFrom(req)
    );
  }

  const owner = await prisma.user.findFirst({
    where: { role: 'OWNER', isActive: true },
    select: { phone: true },
  });

  if (settings && owner?.phone) {
    const notificado = await notifyOwnerNewBooking(
      owner.phone,
      result.client.fullName,
      result.appointment.service.name,
      result.appointment.employee.name,
      formattedDate,
      settings.name
    );

    void audit.record(
      {
        action: notificado ? AuditAction.WHATSAPP_SENT : AuditAction.WHATSAPP_FAILED,
        summary: notificado
          ? `Avisou o dono sobre o agendamento de ${result.client.fullName}`
          : `Não conseguiu avisar o dono sobre o agendamento de ${result.client.fullName}`,
        entity: 'whatsapp',
        outcome: notificado ? 'SUCCESS' : 'FAILURE',
        actorKind: 'SYSTEM',
        metadata: { telefone: owner.phone, uso: 'novo agendamento' },
      },
      audit.auditContextFrom(req)
    );
  }

  res.status(201).json({
    appointment: {
      ...result.appointment,
      startsAt: result.appointment.startsAt.toISOString(),
      endsAt: result.appointment.endsAt.toISOString(),
    },
    client: result.client,
    isNewClient: result.isNewClient,
  });
}

/**
 * GET /client/appointments
 * Lista agendamentos do cliente logado
 */
export async function getClientAppointments(req: AuthRequest, res: Response): Promise<void> {
  const clientId = req.user!.clientId!;
  const { status, page = '1', limit = '20' } = req.query;

  const where: any = { clientId };
  if (status) where.status = status;

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      include: {
        service: { select: { id: true, name: true, durationMinutes: true, price: true } },
        // photoUrl: o cliente vê com quem está agendando
        employee: { select: { id: true, name: true, photoUrl: true } },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  res.json({
    appointments: appointments.map((a) => ({
      ...a,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    })),
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string)),
    },
  });
}

/**
 * PATCH /client/appointments/:id/cancel
 * Cliente cancela próprio agendamento
 */
export async function cancelClientAppointment(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason } = req.body;
  const clientId = req.user!.clientId!;

  await cancelBooking(id, clientId, reason);

  await audit.record(
    {
      action: AuditAction.APPOINTMENT_STATUS_CHANGED,
      summary: 'Cliente cancelou o próprio agendamento',
      entity: 'appointment',
      entityId: id,
      actorKind: 'CLIENT',
      actorId: clientId,
      metadata: { status: 'CANCELLED', motivo: reason ?? null },
    },
    audit.auditContextFrom(req)
  );

  res.json({ message: 'Agendamento cancelado com sucesso' });
}

/**
 * GET /booking/public-services
 * Lista serviços para página pública de agendamento
 */
export async function getPublicServices(req: AuthRequest, res: Response): Promise<void> {
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

  // Agrupa por categoria se tiver descrição com categoria
  // Por enquanto retorna lista simples
  res.json({ services });
}

/**
 * GET /booking/public-employees
 * Lista funcionários ativos para página pública
 */
export async function getPublicEmployees(req: AuthRequest, res: Response): Promise<void> {
  const { serviceId } = req.query;

  const where: any = {
    // O DONO também atende. O dono tem papel de OWNER no banco, mas se
    // cadastrou para fazer corte como qualquer profissional — o cliente
    // precisa poder escolher ele.
    role: { in: ['EMPLOYEE', 'OWNER'] },
    isActive: true,
  };

  // Se serviceId fornecido, filtra funcionários que fazem esse serviço
  // Como não temos tabela many-to-many, filtra por specialties
  if (serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: serviceId as string },
      select: { name: true },
    });
    if (service) {
      where.specialties = { has: service.name };
    }
  }

  const employees = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      specialties: true,
      // o cliente escolhe com quem quer fazer o agendamento — mostra o rosto
      photoUrl: true,
    },
  });

  res.json({ employees });
}