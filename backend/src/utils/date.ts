import { format, parseISO, startOfDay, endOfDay, addMinutes, addHours, isBefore, isAfter, isSameDay, setHours, setMinutes } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { env } from '@config/env';

const TIMEZONE = env.NODE_ENV === 'production' ? 'America/Sao_Paulo' : 'America/Sao_Paulo';

/**
 * Converte data UTC para timezone do salão
 */
export function toSalonTimezone(date: Date): Date {
  return utcToZonedTime(date, TIMEZONE);
}

/**
 * Converte data do timezone do salão para UTC
 */
export function fromSalonTimezone(date: Date): Date {
  return zonedTimeToUtc(date, TIMEZONE);
}

/**
 * Formata data para exibição no timezone do salão
 */
export function formatInTimezone(date: Date, pattern: string): string {
  return format(toSalonTimezone(date), pattern, { timeZone: TIMEZONE });
}

/**
 * Formata data/hora para exibição (dd/MM/yyyy HH:mm)
 */
export function formatDateTime(date: Date): string {
  return formatInTimezone(date, 'dd/MM/yyyy HH:mm');
}

/**
 * Formata apenas data (dd/MM/yyyy)
 */
export function formatDate(date: Date): string {
  return formatInTimezone(date, 'dd/MM/yyyy');
}

/**
 * Formata apenas hora (HH:mm)
 */
export function formatTime(date: Date): string {
  return formatInTimezone(date, 'HH:mm');
}

/**
 * Parse seguro de string ISO para Date
 */
export function parseDateTime(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Retorna início do dia no timezone do salão
 */
export function startOfDayInTimezone(date: Date): Date {
  return startOfDay(toSalonTimezone(date));
}

/**
 * Retorna fim do dia no timezone do salão
 */
export function endOfDayInTimezone(date: Date): Date {
  return endOfDay(toSalonTimezone(date));
}

/**
 * Verifica se data é no passado (comparando apenas data)
 */
export function isPastDate(date: Date): boolean {
  return isBefore(startOfDayInTimezone(date), startOfDayInTimezone(new Date()));
}

/**
 * Verifica se data/hora é no passado
 */
export function isPastDateTime(date: Date): boolean {
  return isBefore(date, new Date());
}

/**
 * Adiciona minutos a uma data
 */
export function addMinutesToDate(date: Date, minutes: number): Date {
  return addMinutes(date, minutes);
}

/**
 * Adiciona horas a uma data
 */
export function addHoursToDate(date: Date, hours: number): Date {
  return addHours(date, hours);
}

/**
 * Cria data com hora específica no timezone do salão
 */
export function createDateWithTime(date: Date, hours: number, minutes: number): Date {
  const zoned = toSalonTimezone(date);
  return setMinutes(setHours(zoned, hours), minutes);
}

/**
 * Verifica se duas datas são no mesmo dia
 */
export function isSameDayDate(date1: Date, date2: Date): boolean {
  return isSameDay(toSalonTimezone(date1), toSalonTimezone(date2));
}

/**
 * Gera array de datas entre duas datas (inclusive)
 */
export function getDaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = startOfDayInTimezone(start);
  const last = startOfDayInTimezone(end);

  while (!isAfter(current, last)) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Retorna timezone configurado
 */
export function getSalonTimezone(): string {
  return TIMEZONE;
}