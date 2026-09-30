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
  
  // Filtra slots disponíveis
  const availableSlots = filterAvailableSlots(
    daySlots,
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

  const endsAt = addMinutesToDate(startsAt, service.durationMinutes);
  const bufferMinutes = await getBufferMinutes();

  // Verifica conflitos
  const conflict = await prisma.appointment.findFirst({
    where: {
      employeeId,
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      OR: [
        {
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
      ],
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
      error: `Horário ocupado por ${conflict.client.fullName} (${conflict.service.name}) das ${formatTime(conflictStart)} às ${formatTime(conflictEnd)}`,
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
  const slotAvailable = isSlotAvailable(
    employeeId,
    startsAt,
    service.durationMinutes,
    [], // sem conflitos (já verificado acima)
    bufferMinutes
  );

  if (!slotAvailable) {
    return { valid: false, error: 'Horário fora do expediente ou indisponível' };
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
    throw new Error('Serviço não encontrado');
  }

  const endsAt = addMinutesToDate(startsAt, service.durationMinutes);

  // Valida slot
  const validation = await validateBookingSlot(employeeId, serviceId, startsAt);
  if (!validation.valid) {
    throw new Error(validation.error || 'Horário não disponível');
  }

  // Find or create client
  let clientRecord = await prisma.client.findUnique({
    where: { phone: client.phone },
  });

  let isNewClient = false;

  if (!clientRecord) {
    // Novo cliente - exige nome e nascimento
    if (!client.fullName || !client.birthDate) {
      throw new Error('Novo cliente requer nome completo e data de nascimento');
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
    throw new Error('Agendamento não encontrado');
  }

  if (appointment.clientId !== clientId) {
    throw new Error('Não autorizado a cancelar este agendamento');
  }

  if (appointment.status !== 'SCHEDULED') {
    throw new Error('Apenas agendamentos agendados podem ser cancelados');
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
    throw new Error('Agendamento não encontrado');
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