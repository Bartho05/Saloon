export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface BusinessHours {
  [dayOfWeek: number]: { open: string; close: string } | null; // 0=Dom, 6=Sáb
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  0: null,                    // Domingo fechado
  1: { open: '09:00', close: '19:00' }, // Segunda
  2: { open: '09:00', close: '19:00' },
  3: { open: '09:00', close: '19:00' },
  4: { open: '09:00', close: '19:00' },
  5: { open: '09:00', close: '19:00' },
  6: { open: '09:00', close: '17:00' }, // Sábado até 17h
};

export const BUFFER_MINUTES = 10; // Intervalo entre agendamentos
export const SLOT_INTERVAL = 30;  // Slots de 30 em 30 min

/**
 * Gera todos os slots possíveis para um dia, dado o horário de funcionamento
 */
export function generateDaySlots(date: Date, businessHours: BusinessHours): TimeSlot[] {
  const day = date.getDay();
  const hours = businessHours[day];
  
  if (!hours) return []; // Fechado

  const slots: TimeSlot[] = [];
  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);

  let current = new Date(date);
  current.setHours(openH, openM, 0, 0);
  
  const end = new Date(date);
  end.setHours(closeH, closeM, 0, 0);

  while (current < end) {
    const slotEnd = new Date(current.getTime() + SLOT_INTERVAL * 60000);
    if (slotEnd <= end) {
      slots.push({
        start: new Date(current),
        end: slotEnd,
        available: true // será filtrado depois
      });
    }
    current = slotEnd;
  }
  return slots;
}

/**
 * Filtra slots removendo os ocupados + buffer
 */
export function filterAvailableSlots(
  slots: TimeSlot[],
  existingAppointments: { startsAt: Date; endsAt: Date }[],
  serviceDuration: number,
  bufferMinutes: number = BUFFER_MINUTES
): TimeSlot[] {
  return slots.map(slot => {
    const slotEnd = new Date(slot.start.getTime() + serviceDuration * 60000);
    
    // Verifica conflito com agendamentos existentes (+ buffer)
    const hasConflict = existingAppointments.some(apt => {
      const aptStart = new Date(apt.startsAt).getTime() - bufferMinutes * 60000;
      const aptEnd = new Date(apt.endsAt).getTime() + bufferMinutes * 60000;
      const slotStartTime = slot.start.getTime();
      const slotEndTime = slotEnd.getTime();
      
      // Overlap: (StartA < EndB) && (EndA > StartB)
      return slotStartTime < aptEnd && slotEndTime > aptStart;
    });

    // Verifica se o slot cabe até o fechamento
    const fitsInDay = !hasConflict && slotEnd <= slots[slots.length - 1]?.end;

    // Preserva a marcação que o slot já trazia. O chamador desmarca o que
    // já passou antes de chamar esta função; sobrescrever com `fitsInDay`
    // ignorava isso e devolvia horário vencido como disponível.
    return { ...slot, available: slot.available && fitsInDay };
  });
}

/**
 * Verifica se um horário específico está livre (para validação final no POST)
 */
export function isSlotAvailable(
  employeeId: string,
  startsAt: Date,
  serviceDuration: number,
  existingAppointments: { startsAt: Date; endsAt: Date }[],
  bufferMinutes: number = BUFFER_MINUTES
): boolean {
  const endsAt = new Date(startsAt.getTime() + serviceDuration * 60000);
  
  return !existingAppointments.some(apt => {
    const aptStart = new Date(apt.startsAt).getTime() - bufferMinutes * 60000;
    const aptEnd = new Date(apt.endsAt).getTime() + bufferMinutes * 60000;
    return startsAt.getTime() < aptEnd && endsAt.getTime() > aptStart;
  });
}

/**
 * Converte slots para formato amigável para frontend
 */
export function formatSlotsForFrontend(slots: TimeSlot[]): Record<string, { time: string; available: boolean }[]> {
  const grouped: Record<string, { time: string; available: boolean }[]> = {};
  
  for (const slot of slots) {
    const hour = slot.start.getHours();
    const key = `${hour}h`;
    
    if (!grouped[key]) grouped[key] = [];
    
    grouped[key].push({
      time: slot.start.toISOString(),
      available: slot.available,
    });
  }
  
  return grouped;
}