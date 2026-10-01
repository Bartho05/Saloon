import { Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import {
  updateAppointmentStatusSchema,
  listAppointmentsSchema,
  uuidParamSchema,
} from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import { updateAppointmentStatus } from '@services/scheduleService';
import { startOfSalonDay, startOfNextSalonDay } from '@utils/date';
import { sendAppointmentCancellation, sendAppointmentConfirmation } from '@services/whatsappService';

/**
 * GET /owner/appointments
 * Lista todos os agendamentos (owner) com filtros
 */
export async function getAllAppointments(req: AuthRequest, res: Response): Promise<void> {
  const { status, startDate, endDate, employeeId, page = '1', limit = '50' } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (employeeId) where.employeeId = employeeId;
  if (startDate || endDate) {
    where.startsAt = {};
    // 'YYYY-MM-DD' é um dia civil do salão, não um instante UTC. Converter
    // com `new Date()` cortaria o último dia do período; `startOfNextSalonDay`
    // como limite exclusivo evita também o 23:59:59.999.
    if (startDate) where.startsAt.gte = startOfSalonDay(startDate as string);
    if (endDate) where.startsAt.lt = startOfNextSalonDay(endDate as string);
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      include: {
        client: { select: { id: true, fullName: true, phone: true } },
        service: { select: { id: true, name: true, durationMinutes: true, price: true } },
        // foto do profissional, para o card da agenda mostrar com quem é
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
 * GET /owner/appointments/today
 * Agendamentos de hoje (owner)
 */
export async function getTodayAppointments(req: AuthRequest, res: Response): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: today, lt: tomorrow },
      status: { in: ['SCHEDULED', 'COMPLETED'] },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      service: { select: { id: true, name: true, durationMinutes: true, price: true } },
      employee: { select: { id: true, name: true, photoUrl: true } },
    },
  });

  res.json({
    appointments: appointments.map((a) => ({
      ...a,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    })),
  });
}

/**
 * GET /employee/appointments
 * Agendamentos do funcionário logado
 */
export async function getEmployeeAppointments(req: AuthRequest, res: Response): Promise<void> {
  const employeeId = req.userEntity!.id;
  const { status, startDate, endDate, page = '1', limit = '20' } = req.query;

  const where: any = { employeeId };
  if (status) where.status = status;
  if (startDate || endDate) {
    where.startsAt = {};
    // mesmo cuidado do dono: dia civil do salão, não instante UTC
    if (startDate) where.startsAt.gte = startOfSalonDay(startDate as string);
    if (endDate) where.startsAt.lt = startOfNextSalonDay(endDate as string);
  }

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      include: {
        client: { select: { id: true, fullName: true, phone: true, birthDate: true } },
        service: { select: { id: true, name: true, durationMinutes: true, price: true } },
        // foto do profissional: o card mostra com quem o cliente marcou
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
 * GET /employee/appointments/today
 * Agendamentos de hoje do funcionário
 */
export async function getEmployeeTodayAppointments(req: AuthRequest, res: Response): Promise<void> {
  const employeeId = req.userEntity!.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      employeeId,
      startsAt: { gte: today, lt: tomorrow },
      status: { in: ['SCHEDULED', 'COMPLETED'] },
    },
    orderBy: { startsAt: 'asc' },
    include: {
      client: { select: { id: true, fullName: true, phone: true, birthDate: true } },
      service: { select: { id: true, name: true, durationMinutes: true, price: true } },
    },
  });

  res.json({
    appointments: appointments.map((a) => ({
      ...a,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
    })),
  });
}

/**
 * PATCH /appointments/:id/status
 * Atualiza status do agendamento (employee/owner)
 */
export async function updateAppointmentStatusController(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, notes } = req.body;
  const userId = req.userEntity!.id;
  const userRole = 'role' in req.userEntity! ? req.userEntity!.role : 'OWNER';

  // Verifica se agendamento existe
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });

  if (!appointment) {
    throw new AppError('Agendamento não encontrado', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // Verifica permissão: dono pode todos, funcionário só os seus
  if (userRole === 'EMPLOYEE' && appointment.employeeId !== userId) {
    throw new AppError('Não autorizado a alterar este agendamento', 403, 'FORBIDDEN');
  }

  await updateAppointmentStatus(id, status, notes, userId);

  // Envia notificação se cancelado pelo salão
  if (status === 'CANCELLED' && appointment.status !== 'CANCELLED') {
    const settings = await prisma.salonSettings.findUnique({
      where: { id: 1 },
      select: { name: true },
    });

    if (settings) {
      await sendAppointmentCancellation({
        clientName: appointment.client.fullName,
        clientPhone: appointment.client.phone,
        serviceName: appointment.service.name,
        dateTime: appointment.startsAt.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        salonName: settings.name,
        reason: notes,
      });
    }
  }

  // Se completado, envia confirmação
  if (status === 'COMPLETED' && appointment.status !== 'COMPLETED') {
    const settings = await prisma.salonSettings.findUnique({
      where: { id: 1 },
      select: { name: true },
    });

    if (settings) {
      await sendAppointmentConfirmation({
        clientName: appointment.client.fullName,
        clientPhone: appointment.client.phone,
        serviceName: appointment.service.name,
        employeeName: appointment.employee.name,
        dateTime: appointment.startsAt.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        salonName: settings.name,
      });
    }
  }

  res.json({ message: 'Status atualizado com sucesso' });
}

/**
 * GET /appointments/:id
 * Busca agendamento por ID
 */
export async function getAppointmentById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, fullName: true, phone: true, birthDate: true } },
      service: { select: { id: true, name: true, durationMinutes: true, price: true } },
      employee: { select: { id: true, name: true, phone: true, photoUrl: true } },
    },
  });

  if (!appointment) {
    throw new AppError('Agendamento não encontrado', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // Verifica permissão
  const userRole = req.user!.role;
  const userId = req.userEntity?.id;

  if (userRole === 'CLIENT' && appointment.clientId !== userId) {
    throw new AppError('Não autorizado', 403, 'FORBIDDEN');
  }
  if (userRole === 'EMPLOYEE' && appointment.employeeId !== userId) {
    throw new AppError('Não autorizado', 403, 'FORBIDDEN');
  }

  res.json({
    appointment: {
      ...appointment,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
    },
  });
}