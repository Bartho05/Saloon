import { addDays, isSameDay, startOfDay } from 'date-fns';

// Feriados nacionais fixos do Brasil (2024-2027)
const NATIONAL_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01', '2024-02-12', '2024-02-13', '2024-03-29', '2024-04-21',
  '2024-05-01', '2024-05-30', '2024-09-07', '2024-10-12', '2024-11-02',
  '2024-11-15', '2024-12-25',
  // 2025
  '2025-01-01', '2025-03-03', '2025-03-04', '2025-04-18', '2025-04-21',
  '2025-05-01', '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02',
  '2025-11-15', '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-05-28', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21',
  '2027-05-01', '2027-05-06', '2027-09-07', '2027-10-12', '2027-11-02',
  '2027-11-15', '2027-12-25',
];

// Feriados opcionais/regionais
const OPTIONAL_HOLIDAYS: string[] = [
  '2024-07-09', '2025-07-09', '2026-07-09', '2027-07-09', // Rev. Constitucionalista (SP)
  '2024-11-20', '2025-11-20', '2026-11-20', '2027-11-20', // Consciência Negra
];

export interface BlockedDateConfig {
  nationalHolidays: boolean;
  optionalHolidays: boolean;
  customBlockedDates: string[]; // YYYY-MM-DD
  employeeVacations: Record<string, string[]>; // employeeId -> [YYYY-MM-DD]
  weeklyClosures: number[]; // dias da semana fechados (0=Dom)
}

export const DEFAULT_BLOCKED_CONFIG: BlockedDateConfig = {
  nationalHolidays: true,
  optionalHolidays: false,
  customBlockedDates: [],
  employeeVacations: {},
  weeklyClosures: [0], // Domingo
};

/**
 * Formata data como YYYY-MM-DD (timezone safe)
 */
export function formatDateKey(date: Date): string {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse seguro de YYYY-MM-DD
 */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Verifica se uma data está bloqueada
 */
export function isDateBlocked(
  date: Date,
  config: BlockedDateConfig,
  employeeId?: string
): { blocked: boolean; reason?: string } {
  const dateStr = formatDateKey(date);
  const dayOfWeek = date.getDay();

  // 1. Fechamento semanal
  if (config.weeklyClosures.includes(dayOfWeek)) {
    return { blocked: true, reason: 'Dia de fechamento semanal' };
  }

  // 2. Feriados nacionais
  if (config.nationalHolidays && NATIONAL_HOLIDAYS.includes(dateStr)) {
    return { blocked: true, reason: 'Feriado nacional' };
  }

  // 3. Feriados opcionais
  if (config.optionalHolidays && OPTIONAL_HOLIDAYS.includes(dateStr)) {
    return { blocked: true, reason: 'Feriado opcional' };
  }

  // 4. Datas customizadas (manutenção, eventos, etc)
  if (config.customBlockedDates.includes(dateStr)) {
    return { blocked: true, reason: 'Data bloqueada pelo salão' };
  }

  // 5. Férias do funcionário
  if (employeeId && config.employeeVacations[employeeId]?.includes(dateStr)) {
    return { blocked: true, reason: 'Profissional de férias' };
  }

  return { blocked: false };
}

/**
 * Gera array de dias bloqueados para um mês (para calendário)
 */
export function getBlockedDaysInMonth(
  year: number,
  month: number, // 0-11
  config: BlockedDateConfig,
  employeeId?: string
): number[] {
  const blocked: number[] = [];
  const date = new Date(year, month, 1);
  
  while (date.getMonth() === month) {
    if (isDateBlocked(date, config, employeeId).blocked) {
      blocked.push(date.getDate());
    }
    date.setDate(date.getDate() + 1);
  }
  return blocked;
}

/**
 * Verifica se data é feriado nacional
 */
export function isNationalHoliday(date: Date): boolean {
  return NATIONAL_HOLIDAYS.includes(formatDateKey(date));
}

/**
 * Verifica se data é feriado opcional
 */
export function isOptionalHoliday(date: Date): boolean {
  return OPTIONAL_HOLIDAYS.includes(formatDateKey(date));
}

/**
 * Retorna nome do feriado se for feriado
 */
export function getHolidayName(date: Date): string | null {
  const dateStr = formatDateKey(date);
  
  const holidayNames: Record<string, string> = {
    '01-01': 'Confraternização Universal',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalhador',
    '09-07': 'Independência do Brasil',
    '10-12': 'Nossa Senhora Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '12-25': 'Natal',
    '07-09': 'Revolução Constitucionalista (SP)',
    '11-20': 'Consciência Negra',
  };

  // Carnavais e Páscoa variam por ano
  const easterHolidays: Record<string, string> = {
    // 2024
    '2024-02-12': 'Carnaval (Segunda)',
    '2024-02-13': 'Carnaval (Terça)',
    '2024-03-29': 'Sexta-feira Santa',
    '2024-05-30': 'Corpus Christi',
    // 2025
    '2025-03-03': 'Carnaval (Segunda)',
    '2025-03-04': 'Carnaval (Terça)',
    '2025-04-18': 'Sexta-feira Santa',
    '2025-06-19': 'Corpus Christi',
    // 2026
    '2026-02-16': 'Carnaval (Segunda)',
    '2026-02-17': 'Carnaval (Terça)',
    '2026-04-03': 'Sexta-feira Santa',
    '2026-05-28': 'Corpus Christi',
    // 2027
    '2027-02-08': 'Carnaval (Segunda)',
    '2027-02-09': 'Carnaval (Terça)',
    '2027-03-26': 'Sexta-feira Santa',
    '2027-05-06': 'Corpus Christi',
  };

  return easterHolidays[dateStr] || holidayNames[dateStr.substring(5)] || null;
}