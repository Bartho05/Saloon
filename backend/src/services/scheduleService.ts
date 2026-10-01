import { Prisma } from '@prisma/client';
import prisma from '@config/database';
import {
  generateDaySlots,
  filterAvailableSlots,
  isSlotAvailable,
  DEFAULT_BUSINESS_HOURS,
  BUFFER_MINUTES,
  SLOT_INTERVAL,
  type TimeSlot,
  type BusinessHours,
} from '@utils/schedule';
import { isDateBlocked, getBlockedDaysInMonth, DEFAULT_BLOCKED_CONFIG, type BlockedDateConfig } from '@utils/holidays';
import { toSalonTimezone, startOfDayInTimezone, endOfDayInTimezone } from '@utils/date';
import { AppError } from '@middlewares/errorHandler';

export interface AvailableSlotsResult {
  slots: TimeSlot[];
  grouped: Record<number, string[]>; // hour -> array of ISO strings
  blockedReason?: string;
}

export interface BookingValidationResult {
  valid: boolean;
  error?: string;
  conflictAppointment?: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    clientName: string;
    serviceName: string;
  };
}

/**
 * Busca configuração de horários do salão
 */
async function getBusinessHours(): Promise<BusinessHours> {
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { businessHours: true, bufferMinutes: true, slotInterval: true },
  });

  if (settings?.businessHours) {
    return settings.businessHours as unknown as BusinessHours;
  }

  return DEFAULT_BUSINESS_HOURS;
}

async function getBufferMinutes(): Promise<number> {
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { bufferMinutes: true },
  });
  return settings?.bufferMinutes ?? BUFFER_MINUTES;
}

async function getSlotInterval(): Promise<number> {
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { slotInterval: true },
  });
  return settings?.slotInterval ?? SLOT_INTERVAL;
}

async function getBlockedConfig(): Promise<BlockedDateConfig> {
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { businessHours: true },
  });

  // Busca férias dos funcionários ativos
  const employees = await prisma.user.findMany({
    where: { isActive: true, role: 'EMPLOYEE' },
    select: { id: true },
  });

  const employeeVacations: Record<string, string[]> = {};
  // TODO: Implementar modelo de férias quando necessário

  return {
    ...DEFAULT_BLOCKED_CONFIG,
    weeklyClosures: Object.entries(settings?.businessHours as BusinessHours || DEFAULT_BUSINESS_HOURS)
      .filter(([, v]) => v === null)
      .map(([k]) => parseInt(k)),
    employeeVacations,
  };
}

/**
 * Gera slots disponíveis para um funcionário em uma data
 */
export async function getAvailableSlots(
  employeeId: string,
  serviceId: string,
  date: Date
): Promise<AvailableSlotsResult> {
  // Verifica se funcionário existe e está ativo
  const employee = await prisma.user.findUnique({
    where: { id: employeeId, isActive: true },
    select: { id: true },
  });

  if (!employee) {
    return { slots: [], grouped: {}, blockedReason: 'Funcionário não encontrado' };
  }

  // Verifica se serviço existe e está ativo
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { id: true, durationMinutes: true },
  });

  if (!service) {
    return { slots: [], grouped: {}, blockedReason: 'Serviço não encontrado' };
  }

  // Verifica se data está bloqueada
  const blockedConfig = await getBlockedConfig();
  const blocked = isDateBlocked(date, blockedConfig, employeeId);
  if (blocked.blocked) {
    return { slots: [], grouped: {}, blockedReason: blocked.reason };
  }

  // Busca agendamentos existentes do funcionário no dia
  const dayStart = startOfDayInTimezone(date);
  const dayEnd = endOfDayInTimezone(date);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      employeeId,
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { in: ['SCHEDULED', 'COMPLETED'] },
    },
    select: { startsAt: true, endsAt: true },
    orderBy: { startsAt: 'asc' },
  });

  // Gera slots do dia
  const businessHours = await getBusinessHours();
  const slotInterval = await getSlotInterval();
  const bufferMinutes = await getBufferMinutes();

  const daySlots = generateDaySlots(date, businessHours);

  // Um horário que já começou não pode mais ser escolhido. Filtrar aqui e
  // não só na criação: às 22h a agenda do dia inteiro aparece como
  // "disponível" e o cliente escolhe um horário que não existe mais.
  const now = new Date();
  const todaySlots = daySlots.map((slot) =>
    slot.start.getTime() > now.getTime() ? slot : { ...slot, available: false }
  );

  // Filtra slots disponíveis
  const availableSlots = filterAvailableSlots(
    todaySlots,
    existingAppointments,
    service.durationMinutes,
    bufferMinutes
  );

  // Agrupa por hora para UI
  const grouped: Record<number, string[]> = {};
  for (const slot of availableSlots) {
    if (slot.available) {
      const hour = slot.start.getHours();
      if (!grouped[hour]) grouped[hour] = [];
      grouped[hour].push(slot.start.toISOString());
    }
  }

  return {
    slots: availableSlots,
    grouped,
  };
}

/**
 * Valida se um horário específico está disponível para agendamento
 */
export async function validateBookingSlot(
  employeeId: string,
  serviceId: string,
  startsAt: Date
): Promise<BookingValidationResult> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { durationMinutes: true },
  });

  if (!service) {
    return { valid: false, error: 'Serviço não encontrado' };
  }

  // Horário já vencido. Esta é a guarda que vale: esconder os slots passados
  // na listagem é conveniência, não proteção — o POST /booking/create aceita
  // qualquer `startsAt`. Sem esta checagem dava para agendar 17:00 às 22:00.
  if (startsAt.getTime() <= Date.now()) {
    return {
      valid: false,
      error: 'Este horário já passou. Escolha outro dia ou horário.',
    };
  }

  const endsAt = addMinutesToDate(startsAt, service.durationMinutes);
  const bufferMinutes = await getBufferMinutes();

  // Janela de bloqueio do novo agendamento, já com a folga applied.
  // O mesmo buffer é aplicado nos agendamentos existentes abaixo, para que
  // a checagem seja simétrica: [inicio, fim) + folga nos dois lados.
  const requestedStartWithBuffer = new Date(startsAt.getTime() - bufferMinutes * 60000);
  const requestedEndWithBuffer = new Date(endsAt.getTime() + bufferMinutes * 60000);

  // Verifica conflitos considerando a janela de bloqueio (buffer).
  // Um agendamento das 15:00 às 15:30 trava o profissional até 15:45 se o
  // buffer for 15 min — qualquer slot que encoste nessa janela é rejeitado.
  const conflict = await prisma.appointment.findFirst({
    where: {
      employeeId,
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      // Sobrepõe considerando o buffer aplicado aos dois lados
      startsAt: { lt: requestedEndWithBuffer },
      endsAt: { gt: requestedStartWithBuffer },
    },
    include: {
      client: { select: { fullName: true } },
      service: { select: { name: true } },
    },
  });

  if (conflict) {
    const conflictStart = toSalonTimezone(conflict.startsAt);
    const conflictEnd = toSalonTimezone(conflict.endsAt);
    return {
      valid: false,
      error: `Horário bloqueado: ${conflict.client.fullName} (${conflict.service.name}) das ${formatTime(conflictStart)} às ${formatTime(conflictEnd)}${bufferMinutes > 0 ? `, com ${bufferMinutes} min de intervalo` : ''}`,
      conflictAppointment: {
        id: conflict.id,
        startsAt: conflict.startsAt,
        endsAt: conflict.endsAt,
        clientName: conflict.client.fullName,
        serviceName: conflict.service.name,
      },
    };
  }

  // Verifica se está dentro do horário de funcionamento
  const businessHours = await getBusinessHours();
  const daySlots = generateDaySlots(startsAt, businessHours);
  const slotAvailable = daySlots.some(
    (slot) => slot.start.getTime() === startsAt.getTime()
  );

  if (!slotAvailable) {
    return { valid: false, error: 'Horário fora do expediente' };
  }

  return { valid: true };
}

/**
 * Cria agendamento com find-or-create client
 */
export async function createBooking(data: {
  serviceId: string;
  employeeId: string;
  startsAt: Date;
  client: {
    phone: string;
    fullName?: string;
    birthDate?: string;
  };
}): Promise<{ appointment: any; client: any; isNewClient: boolean }> {
  const { serviceId, employeeId, startsAt, client } = data;

  const service = await prisma.service.findUnique({
    where: { id: serviceId, isActive: true },
    select: { durationMinutes: true },
  });

  if (!service) {
    throw new AppError('Serviço não encontrado', 404, 'SERVICE_NOT_FOUND');
  }

  const endsAt = addMinutesToDate(startsAt, service.durationMinutes);

  // Valida slot
  const validation = await validateBookingSlot(employeeId, serviceId, startsAt);
  if (!validation.valid) {
    // 409 = conflito de agenda. O frontend trata 409specifically mostrando
    // "horário indisponível" e voltando ao calendário.
    throw new AppError(validation.error || 'Horário não disponível', 409, 'SLOT_UNAVAILABLE');
  }

  // Find or create client
  let clientRecord = await prisma.client.findUnique({
    where: { phone: client.phone },
  });

  let isNewClient = false;

  if (!clientRecord) {
    // Novo cliente - exige nome e nascimento
    if (!client.fullName || !client.birthDate) {
      throw new AppError(
        'Novo cliente requer nome completo e data de nascimento',
        400,
        'CLIENT_DATA_REQUIRED'
      );
    }

    clientRecord = await prisma.client.create({
      data: {
        phone: client.phone,
        fullName: client.fullName,
        birthDate: new Date(client.birthDate),
      },
    });
    isNewClient = true;
  } else if (client.fullName || client.birthDate) {
    // Atualiza dados se fornecidos
    clientRecord = await prisma.client.update({
      where: { id: clientRecord.id },
      data: {
        ...(client.fullName && { fullName: client.fullName }),
        ...(client.birthDate && { birthDate: new Date(client.birthDate) }),
      },
    });
  }

  // Cria agendamento
  const appointment = await prisma.appointment.create({
    data: {
      clientId: clientRecord.id,
      employeeId,
      serviceId,
      startsAt,
      endsAt,
      status: 'SCHEDULED',
    },
    include: {
      client: true,
      employee: { select: { id: true, name: true } },
      service: true,
    },
  });

  return { appointment, client: clientRecord, isNewClient };
}

/**
 * Cancela agendamento
 */
export async function cancelBooking(appointmentId: string, clientId: string, reason?: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { clientId: true, status: true },
  });

  if (!appointment) {
    throw new AppError('Agendamento não encontrado', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (appointment.clientId !== clientId) {
    throw new AppError(
      'Não autorizado a cancelar este agendamento',
      403,
      'FORBIDDEN'
    );
  }

  if (appointment.status !== 'SCHEDULED') {
    // AppError e não Error: um Error cru cai no handler genérico e vira 500,
    // fazendo parecer falha do servidor o que é uma recusa legítima (o
    // cliente tentou cancelar algo já concluído).
    throw new AppError(
      'Apenas agendamentos agendados podem ser cancelados',
      400,
      'APPOINTMENT_NOT_CANCELLABLE'
    );
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: 'CANCELLED',
      notes: reason ? `Cancelado pelo cliente: ${reason}` : 'Cancelado pelo cliente',
    },
  });
}

/**
 * Atualiza status do agendamento (funcionário/dono)
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
  notes?: string,
  userId?: string
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, status: true, employeeId: true },
  });

  if (!appointment) {
    throw new AppError('Agendamento não encontrado', 404, 'APPOINTMENT_NOT_FOUND');
  }

  // TODO: Verificar permissão (dono pode todos, funcionário só seus)

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status,
      notes: notes ? `${notes}` : undefined,
    },
  });
}

// Re-export date utils
import { addMinutes } from 'date-fns';
function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

import { format } from 'date-fns-tz';
function formatTime(date: Date): string {
  return format(date, 'HH:mm', { timeZone: 'America/Sao_Paulo' });
}