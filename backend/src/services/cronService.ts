import cron from 'node-cron';
import prisma from '@config/database';
import { sendBirthdayMessage, sendAppointmentReminder } from './whatsappService';
import { formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Sao_Paulo';

let birthdayJob: cron.ScheduledTask | null = null;
let reminderJob: cron.ScheduledTask | null = null;

/**
 * Inicia jobs agendados
 */
export function startCronJobs(): void {
  if (process.env.NODE_ENV === 'test') return;

  // Job de aniversários - roda todo dia às 09:00
  birthdayJob = cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('🎂 Executando job de aniversários...');
      await processBirthdays();
    },
    { timezone: TIMEZONE }
  );

  // Job de lembretes - roda todo dia às 10:00 (para agendamentos de amanhã)
  reminderJob = cron.schedule(
    '0 10 * * *',
    async () => {
      console.log('⏰ Executando job de lembretes...');
      await processReminders();
    },
    { timezone: TIMEZONE }
  );

  console.log('✅ Jobs agendados iniciados');
}

/**
 * Para jobs agendados
 */
export function stopCronJobs(): void {
  birthdayJob?.stop();
  reminderJob?.stop();
  birthdayJob = null;
  reminderJob = null;
  console.log('🛑 Jobs agendados parados');
}

/** Intervalo [início, fim) do dia de `date` no fuso do salão */
function dayRange(date: Date): { start: Date; end: Date } {
  const day = formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
  const start = new Date(`${day}T00:00:00.000-03:00`);
  const end = new Date(`${day}T23:59:59.999-03:00`);
  return { start, end };
}

/** Clientes que fazem aniversário no dia (mês/dia no fuso do salão) */
function isBirthdayToday(birthDate: Date, reference: Date): boolean {
  return (
    formatInTimeZone(birthDate, TIMEZONE, 'MM-dd') ===
    formatInTimeZone(reference, TIMEZONE, 'MM-dd')
  );
}

async function findBirthdayClients(reference: Date) {
  const clients = await prisma.client.findMany({
    select: { id: true, fullName: true, phone: true, birthDate: true },
  });
  // Cliente sem data de nascimento não tem aniversário a comemorar — antes
  // o `1990-01-01` provisório o fazia receber mensagem todo dia 1º de janeiro.
  return clients.filter(
    (client) => client.birthDate !== null && isBirthdayToday(client.birthDate, reference)
  );
}

async function findTomorrowAppointments(reference: Date) {
  const tomorrow = new Date(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const { start, end } = dayRange(tomorrow);

  return prisma.appointment.findMany({
    where: { startsAt: { gte: start, lte: end }, status: 'SCHEDULED' },
    include: {
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });
}

/**
 * Processa aniversários do dia
 */
async function processBirthdays(): Promise<void> {
  try {
    const settings = await prisma.salonSettings.findUnique({
      where: { id: 1 },
      select: { name: true, birthdayMessage: true },
    });

    if (!settings) {
      console.log('⚠️ Configurações do salão não encontradas');
      return;
    }

    const birthdayClients = await findBirthdayClients(new Date());

    if (birthdayClients.length === 0) {
      console.log('🎂 Nenhum aniversariante hoje');
      return;
    }

    console.log(`🎂 Enviando mensagens para ${birthdayClients.length} aniversariante(s)`);

    const results = await Promise.allSettled(
      birthdayClients.map((client) =>
        sendBirthdayMessage({
          clientName: client.fullName,
          clientPhone: client.phone,
          salonName: settings.name,
          customMessage: settings.birthdayMessage || undefined,
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    console.log(`🎂 Aniversários: ${sent} enviados, ${results.length - sent} falharam`);
  } catch (error) {
    console.error('❌ Erro no job de aniversários:', error);
  }
}

/**
 * Processa lembretes de agendamentos para amanhã
 */
async function processReminders(): Promise<void> {
  try {
    const appointments = await findTomorrowAppointments(new Date());

    if (appointments.length === 0) {
      console.log('⏰ Nenhum lembrete para enviar');
      return;
    }

    const settings = await prisma.salonSettings.findUnique({
      where: { id: 1 },
      select: { name: true },
    });

    if (!settings) return;

    console.log(`⏰ Enviando ${appointments.length} lembrete(s)`);

    const results = await Promise.allSettled(
      appointments.map((apt) =>
        sendAppointmentReminder({
          clientName: apt.client.fullName,
          clientPhone: apt.client.phone,
          serviceName: apt.service.name,
          employeeName: apt.employee.name,
          dateTime: formatInTimeZone(apt.startsAt, TIMEZONE, "dd/MM/yyyy 'às' HH:mm"),
          salonName: settings.name,
        })
      )
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    console.log(`⏰ Lembretes: ${sent} enviados, ${results.length - sent} falharam`);
  } catch (error) {
    console.error('❌ Erro no job de lembretes:', error);
  }
}

/**
 * Executa job de aniversários manualmente (para teste)
 */
export async function runBirthdayJobNow(): Promise<{ sent: number; failed: number }> {
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true, birthdayMessage: true },
  });

  if (!settings) return { sent: 0, failed: 0 };

  const birthdayClients = await findBirthdayClients(new Date());

  const results = await Promise.allSettled(
    birthdayClients.map((client) =>
      sendBirthdayMessage({
        clientName: client.fullName,
        clientPhone: client.phone,
        salonName: settings.name,
        customMessage: settings.birthdayMessage || undefined,
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  return { sent, failed: results.length - sent };
}

/**
 * Executa job de lembretes manualmente (para teste)
 */
export async function runReminderJobNow(): Promise<{ sent: number; failed: number }> {
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  if (!settings) return { sent: 0, failed: 0 };

  const appointments = await findTomorrowAppointments(new Date());

  const results = await Promise.allSettled(
    appointments.map((apt) =>
      sendAppointmentReminder({
        clientName: apt.client.fullName,
        clientPhone: apt.client.phone,
        serviceName: apt.service.name,
        employeeName: apt.employee.name,
        dateTime: formatInTimeZone(apt.startsAt, TIMEZONE, "dd/MM/yyyy 'às' HH:mm"),
        salonName: settings.name,
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  return { sent, failed: results.length - sent };
}
