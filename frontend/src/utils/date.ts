import { format, parseISO, startOfDay, endOfDay, addMinutes, isBefore, isAfter, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata data/hora para exibição (dd/MM/yyyy HH:mm)
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy HH:mm', { locale: ptBR });
}

/**
 * Formata apenas data (dd/MM/yyyy)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Formata apenas hora (HH:mm)
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm', { locale: ptBR });
}

/**
 * Formata data por extenso (quarta-feira, 15 de janeiro de 2025)
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

/**
 * Formata data curta (qua, 15/01)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEE, dd/MM', { locale: ptBR });
}

/**
 * Verifica se data é no passado (apenas data)
 */
export function isPastDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(startOfDay(d), startOfDay(new Date()));
}

/**
 * Verifica se data/hora é no passado
 */
export function isPastDateTime(date: Date | string): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isBefore(d, new Date());
}

/**
 * Verifica se duas datas são no mesmo dia
 */
export function isSameDayDate(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isSameDay(d1, d2);
}

/**
 * Parse seguro de string ISO
 */
export function parseDateTimeSafe(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Retorna início do dia
 */
export function startOfDayDate(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return startOfDay(d);
}

/**
 * Retorna fim do dia
 */
export function endOfDayDate(date: Date | string): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return endOfDay(d);
}

/**
 * Adiciona minutos a uma data
 */
export function addMinutesToDate(date: Date | string, minutes: number): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return addMinutes(d, minutes);
}

/**
 * Formata telefone para exibição (11) 99999-9999
 */
export function formatPhone(phone: string): string {
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  if (numbers.length === 10) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 6)}-${numbers.slice(6)}`;
  }
  return phone;
}

/**
 * Remove formatação do telefone (apenas números)
 */
export function unformatPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Formata CPF para exibição
 */
export function formatCPF(cpf: string): string {
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length === 11) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
  }
  return cpf;
}

/**
 * Formata moeda brasileira
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata preço de centavos para reais
 */
export function formatPriceFromCents(cents: number): string {
  return formatCurrency(cents / 100);
}