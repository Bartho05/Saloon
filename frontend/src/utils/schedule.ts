export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface BusinessHours {
  [dayOfWeek: number]: { open: string; close: string } | null; // 0=Dom ... 6=Sáb
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  0: null, // Domingo fechado
  1: { open: '09:00', close: '19:00' },
  2: { open: '09:00', close: '19:00' },
  3: { open: '09:00', close: '19:00' },
  4: { open: '09:00', close: '19:00' },
  5: { open: '09:00', close: '19:00' },
  6: { open: '09:00', close: '17:00' },
};

export const BUFFER_MINUTES = 10;
export const SLOT_INTERVAL = 30;

/** Converte os slots recebidos da API (ISO strings) em TimeSlot */
export function parseSlots(
  raw: Array<{ start: string | Date; end: string | Date; available: boolean }>
): TimeSlot[] {
  return raw.map((s) => ({
    start: new Date(s.start),
    end: new Date(s.end),
    available: s.available,
  }));
}

/** Agrupa os slots por hora (ex.: "14h") */
export function groupSlotsByHour(slots: TimeSlot[]): Record<string, TimeSlot[]> {
  const grouped: Record<string, TimeSlot[]> = {};

  for (const slot of slots) {
    const key = `${slot.start.getHours()}h`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(slot);
  }

  return grouped;
}

/** Verifica se um horário está livre considerando os agendamentos existentes */
export function isSlotAvailable(
  startsAt: Date,
  serviceDuration: number,
  existingAppointments: { startsAt: Date | string; endsAt: Date | string }[],
  bufferMinutes: number = BUFFER_MINUTES
): boolean {
  const endsAt = new Date(startsAt.getTime() + serviceDuration * 60000);

  return !existingAppointments.some((apt) => {
    const aptStart = new Date(apt.startsAt).getTime() - bufferMinutes * 60000;
    const aptEnd = new Date(apt.endsAt).getTime() + bufferMinutes * 60000;
    return startsAt.getTime() < aptEnd && endsAt.getTime() > aptStart;
  });
}
