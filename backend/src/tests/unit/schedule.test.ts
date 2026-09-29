import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDaySlots,
  filterAvailableSlots,
  isSlotAvailable,
  DEFAULT_BUSINESS_HOURS,
  BUFFER_MINUTES,
  SLOT_INTERVAL,
} from '@utils/schedule';

describe('Schedule Utils', () => {
  const testDate = new Date('2025-01-15T00:00:00'); // Quarta-feira

  describe('generateDaySlots', () => {
    it('should generate slots for open day', () => {
      const slots = generateDaySlots(testDate, DEFAULT_BUSINESS_HOURS);

      expect(slots.length).toBeGreaterThan(0);
      // 09:00 às 19:00 = 10 horas = 600 min / 30 = 20 slots
      expect(slots.length).toBe(20);

      // Primeiro slot às 09:00
      expect(slots[0].start.getHours()).toBe(9);
      expect(slots[0].start.getMinutes()).toBe(0);

      // Último slot às 18:30
      expect(slots[slots.length - 1].start.getHours()).toBe(18);
      expect(slots[slots.length - 1].start.getMinutes()).toBe(30);

      // Todos disponíveis inicialmente
      expect(slots.every(s => s.available)).toBe(true);
    });

    it('should return empty array for closed day (Sunday)', () => {
      const sunday = new Date('2025-01-19T00:00:00'); // Domingo
      const slots = generateDaySlots(sunday, DEFAULT_BUSINESS_HOURS);
      expect(slots).toEqual([]);
    });

    it('should respect custom business hours', () => {
      const customHours = {
        ...DEFAULT_BUSINESS_HOURS,
        3: { open: '10:00', close: '16:00' }, // Quarta reduzida
      };

      const slots = generateDaySlots(testDate, customHours);
      // 10:00 às 16:00 = 6 horas = 360 min / 30 = 12 slots
      expect(slots.length).toBe(12);
      expect(slots[0].start.getHours()).toBe(10);
      expect(slots[slots.length - 1].start.getHours()).toBe(15);
      expect(slots[slots.length - 1].start.getMinutes()).toBe(30);
    });
  });

  describe('filterAvailableSlots', () => {
    it('should mark conflicting slots as unavailable', () => {
      const slots = generateDaySlots(testDate, DEFAULT_BUSINESS_HOURS);

      // Agendamento das 10:00 às 11:00 (duração 60 min)
      const existingAppointments = [
        {
          startsAt: new Date('2025-01-15T10:00:00'),
          endsAt: new Date('2025-01-15T11:00:00'),
        },
      ];

      const filtered = filterAvailableSlots(slots, existingAppointments, 60, BUFFER_MINUTES);

      // Slots das 09:30 até 11:00 devem estar indisponíveis (com buffer de 10 min)
      const slot0930 = filtered.find(s => s.start.getHours() === 9 && s.start.getMinutes() === 30);
      const slot1000 = filtered.find(s => s.start.getHours() === 10 && s.start.getMinutes() === 0);
      const slot1030 = filtered.find(s => s.start.getHours() === 10 && s.start.getMinutes() === 30);
      const slot1100 = filtered.find(s => s.start.getHours() === 11 && s.start.getMinutes() === 0);

      expect(slot0930?.available).toBe(false); // buffer antes
      expect(slot1000?.available).toBe(false); // conflito direto
      expect(slot1030?.available).toBe(false); // conflito direto
      expect(slot1100?.available).toBe(false); // buffer depois
    });

    it('should not affect non-conflicting slots', () => {
      const slots = generateDaySlots(testDate, DEFAULT_BUSINESS_HOURS);

      const existingAppointments = [
        {
          startsAt: new Date('2025-01-15T10:00:00'),
          endsAt: new Date('2025-01-15T11:00:00'),
        },
      ];

      const filtered = filterAvailableSlots(slots, existingAppointments, 30, BUFFER_MINUTES);

      // Slot das 14:00 deve estar livre
      const slot1400 = filtered.find(s => s.start.getHours() === 14 && s.start.getMinutes() === 0);
      expect(slot1400?.available).toBe(true);
    });

    it('should handle multiple appointments', () => {
      const slots = generateDaySlots(testDate, DEFAULT_BUSINESS_HOURS);

      const existingAppointments = [
        { startsAt: new Date('2025-01-15T10:00:00'), endsAt: new Date('2025-01-15T11:00:00') },
        { startsAt: new Date('2025-01-15T14:00:00'), endsAt: new Date('2025-01-15T15:00:00') },
      ];

      const filtered = filterAvailableSlots(slots, existingAppointments, 30, BUFFER_MINUTES);

      // Verifica ambos os bloqueios
      const slot1000 = filtered.find(s => s.start.getHours() === 10 && s.start.getMinutes() === 0);
      const slot1400 = filtered.find(s => s.start.getHours() === 14 && s.start.getMinutes() === 0);

      expect(slot1000?.available).toBe(false);
      expect(slot1400?.available).toBe(false);
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true for available slot', () => {
      const existingAppointments = [
        { startsAt: new Date('2025-01-15T10:00:00'), endsAt: new Date('2025-01-15T11:00:00') },
      ];

      const available = isSlotAvailable(
        'emp1',
        new Date('2025-01-15T14:00:00'),
        30,
        existingAppointments,
        BUFFER_MINUTES
      );

      expect(available).toBe(true);
    });

    it('should return false for conflicting slot', () => {
      const existingAppointments = [
        { startsAt: new Date('2025-01-15T10:00:00'), endsAt: new Date('2025-01-15T11:00:00') },
      ];

      const available = isSlotAvailable(
        'emp1',
        new Date('2025-01-15T10:30:00'),
        30,
        existingAppointments,
        BUFFER_MINUTES
      );

      expect(available).toBe(false);
    });

    it('should respect buffer minutes', () => {
      const existingAppointments = [
        { startsAt: new Date('2025-01-15T10:00:00'), endsAt: new Date('2025-01-15T11:00:00') },
      ];

      // 09:50 - dentro do buffer de 10 min antes das 10:00
      const available = isSlotAvailable(
        'emp1',
        new Date('2025-01-15T09:50:00'),
        30,
        existingAppointments,
        10
      );

      expect(available).toBe(false);
    });
  });
});