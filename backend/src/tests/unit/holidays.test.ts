import { describe, it, expect } from 'vitest';
import {
  isDateBlocked,
  getBlockedDaysInMonth,
  formatDateKey,
  parseDateKey,
  isNationalHoliday,
  isOptionalHoliday,
  getHolidayName,
  DEFAULT_BLOCKED_CONFIG,
} from '@utils/holidays';

describe('Holidays Utils', () => {
  describe('formatDateKey', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-15T10:30:00');
      expect(formatDateKey(date)).toBe('2025-01-15');
    });

    it('should pad month and day with zeros', () => {
      const date = new Date('2025-03-05T00:00:00');
      expect(formatDateKey(date)).toBe('2025-03-05');
    });
  });

  describe('parseDateKey', () => {
    it('should parse YYYY-MM-DD to Date', () => {
      const date = parseDateKey('2025-01-15');
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0); // Janeiro = 0
      expect(date.getDate()).toBe(15);
    });
  });

  describe('isNationalHoliday', () => {
    it('should return true for fixed national holidays', () => {
      expect(isNationalHoliday(new Date('2025-01-01'))).toBe(true); // Ano Novo
      expect(isNationalHoliday(new Date('2025-04-21'))).toBe(true); // Tiradentes
      expect(isNationalHoliday(new Date('2025-05-01'))).toBe(true); // Dia do Trabalhador
      expect(isNationalHoliday(new Date('2025-09-07'))).toBe(true); // Independência
      expect(isNationalHoliday(new Date('2025-10-12'))).toBe(true); // Padroeira
      expect(isNationalHoliday(new Date('2025-11-02'))).toBe(true); // Finados
      expect(isNationalHoliday(new Date('2025-11-15'))).toBe(true); // Proclamação
      expect(isNationalHoliday(new Date('2025-12-25'))).toBe(true); // Natal
    });

    it('should return true for variable holidays (Carnaval, Páscoa)', () => {
      expect(isNationalHoliday(new Date('2025-03-03'))).toBe(true); // Carnaval 2025
      expect(isNationalHoliday(new Date('2025-03-04'))).toBe(true); // Carnaval 2025
      expect(isNationalHoliday(new Date('2025-04-18'))).toBe(true); // Sexta Santa 2025
      expect(isNationalHoliday(new Date('2025-06-19'))).toBe(true); // Corpus Christi 2025
    });

    it('should return false for regular days', () => {
      expect(isNationalHoliday(new Date('2025-01-15'))).toBe(false);
      expect(isNationalHoliday(new Date('2025-06-15'))).toBe(false);
    });
  });

  describe('isOptionalHoliday', () => {
    it('should return true for optional holidays', () => {
      expect(isOptionalHoliday(new Date('2025-07-09'))).toBe(true); // Rev. Constitucionalista SP
      expect(isOptionalHoliday(new Date('2025-11-20'))).toBe(true); // Consciência Negra
    });

    it('should return false for non-optional days', () => {
      expect(isOptionalHoliday(new Date('2025-01-15'))).toBe(false);
    });
  });

  describe('getHolidayName', () => {
    it('should return holiday name for known holidays', () => {
      expect(getHolidayName(new Date('2025-01-01'))).toBe('Confraternização Universal');
      expect(getHolidayName(new Date('2025-04-21'))).toBe('Tiradentes');
      expect(getHolidayName(new Date('2025-12-25'))).toBe('Natal');
    });

    it('should return variable holiday names', () => {
      expect(getHolidayName(new Date('2025-03-03'))).toBe('Carnaval (Segunda)');
      expect(getHolidayName(new Date('2025-04-18'))).toBe('Sexta-feira Santa');
    });

    it('should return null for non-holidays', () => {
      expect(getHolidayName(new Date('2025-01-15'))).toBeNull();
    });
  });

  describe('isDateBlocked', () => {
    it('should block weekly closures (Sunday by default)', () => {
      const sunday = new Date('2025-01-19'); // Domingo
      const result = isDateBlocked(sunday, DEFAULT_BLOCKED_CONFIG);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Dia de fechamento semanal');
    });

    it('should block national holidays when enabled', () => {
      const holiday = new Date('2025-01-01'); // Ano Novo
      const result = isDateBlocked(holiday, DEFAULT_BLOCKED_CONFIG);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Feriado nacional');
    });

    it('should not block national holidays when disabled', () => {
      const config = { ...DEFAULT_BLOCKED_CONFIG, nationalHolidays: false };
      const holiday = new Date('2025-01-01');
      const result = isDateBlocked(holiday, config);
      expect(result.blocked).toBe(false);
    });

    it('should block optional holidays when enabled', () => {
      const config = { ...DEFAULT_BLOCKED_CONFIG, optionalHolidays: true };
      const holiday = new Date('2025-11-20'); // Consciência Negra
      const result = isDateBlocked(holiday, config);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Feriado opcional');
    });

    it('should block custom dates', () => {
      const config = { ...DEFAULT_BLOCKED_CONFIG, customBlockedDates: ['2025-01-15'] };
      const date = new Date('2025-01-15');
      const result = isDateBlocked(date, config);
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Data bloqueada pelo salão');
    });

    it('should block employee vacations', () => {
      const config = {
        ...DEFAULT_BLOCKED_CONFIG,
        employeeVacations: { 'emp1': ['2025-01-15'] },
      };
      const date = new Date('2025-01-15');
      const result = isDateBlocked(date, config, 'emp1');
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Profissional de férias');
    });

    it('should not block other employees on vacation', () => {
      const config = {
        ...DEFAULT_BLOCKED_CONFIG,
        employeeVacations: { 'emp1': ['2025-01-15'] },
      };
      const date = new Date('2025-01-15');
      const result = isDateBlocked(date, config, 'emp2');
      expect(result.blocked).toBe(false);
    });
  });

  describe('getBlockedDaysInMonth', () => {
    it('should return blocked days for January 2025', () => {
      const blocked = getBlockedDaysInMonth(2025, 0, DEFAULT_BLOCKED_CONFIG); // Janeiro = 0

      // Domingos em janeiro 2025: 5, 12, 19, 26
      // Feriados: 1 (Ano Novo)
      expect(blocked).toContain(1);
      expect(blocked).toContain(5);
      expect(blocked).toContain(12);
      expect(blocked).toContain(19);
      expect(blocked).toContain(26);
    });

    it('should include employee vacations', () => {
      const config = {
        ...DEFAULT_BLOCKED_CONFIG,
        employeeVacations: { 'emp1': ['2025-01-10', '2025-01-11'] },
      };

      const blocked = getBlockedDaysInMonth(2025, 0, config, 'emp1');
      expect(blocked).toContain(10);
      expect(blocked).toContain(11);
    });
  });
});