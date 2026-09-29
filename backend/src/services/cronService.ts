import cron from 'node-cron';
import prisma from '@config/database';
import { sendBirthdayMessage } from './whatsappService';
import { format } from 'date-fns-tz';

let birthdayJob: cron.ScheduledTask | null = null;
let reminderJob: cron.ScheduledTask | null = null;

/**
 * Inicia jobs agendados
 */
export function startCronJobs(): void {
  if (process.env.NODE_ENV === 'test') return;

  // Job de aniversários - roda todo dia às 09:00
  birthdayJob = cron.schedule('0 9 * * *', async () => {
    console.log('🎂 Executando job de aniversários...');
    await processBirthdays();
  }, {
    timezone: 'America/Sao_Paulo',
  });

  // Job de lembretes - roda todo dia às 10:00 (para agendamentos de amanhã)
  reminderJob = cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Executando job de lembretes...');
    await processReminders();
  }, {
    timezone: 'America/Sao_Paulo',
  });

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

/**
 * Processa aniversários do dia
 */
async function processBirthdays(): Promise<void> {
  try {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Busca configurações do salão
    const settings = await prisma.salonSettings.findUnique({
      where: { id: 1 },
      select: { name: true, birthdayMessage: true },
    });

    if (!settings) {
      console.log('⚠️ Configurações do salão não encontradas');
      return;
    }

    // Busca clientes aniversariantes
    const clients = await prisma.client.findMany({
      where: {
        birthDate: {
          // Prisma não suporta query direta de mês/dia, filtramos em memória
        },
      },
      select: { id: true, fullName: true, phone: true, birthDate: true },
    });

    // Filtra aniversariantes de hoje
    const birthdayClients = clients.filter((client) => {
      const birthDate = new Date(client.birthDate);
      return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
    });

    if (birthdayClients.length === 0) {
      console.log('🎂 Nenhum aniversariante hoje');
      return;
    }

    console.log(`🎂 Enviando mensagens para ${birthdayClients.length} aniversariante(s)`);

    // Envia mensagens em paralelo (com limite)
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

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;

    console.log(`🎂 Aniversários: ${successful} enviados, ${failed} falharam`);
  } catch (error) {
    console.error('❌ Erro no job de aniversários:', error);
  }
}

/**
 * Processa lembretes de agendamentos para amanhã
 */
async function processReminders(): Promise<void> {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayStart = new Date(tomorrow);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(tomorrow);
    dayEnd.setHours(23, 59, 59, 999);

    // Busca agendamentos de amanhã
    const appointments = await prisma.appointment.findMany({
      where: {
        startsAt: { gte: dayStart, lte: dayEnd },
        status: 'SCHEDULED',
      },
      include: {
        client: { select: { fullName: true, phone: true } },
        service: { select: { name: true } },
        employee: { select: { name: true } },
      },
    });

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
        sendWhatsAppMessage({
          phone: apt.client.phone,
          message: `⏰ *Lembrete de Agendamento*\n\n` +
            `Olá ${apt.client.fullName}!\n\n` +
            `Seu agendamento é amanhã:\n` +
            `📅 ${format(apt.startsAt, 'dd/MM/yyyy HH:mm', { timeZone: 'America/Sao_Paulo' })}\n` +
            `✂️ ${apt.service.name}\n` +
            `👤 ${apt.employee.name}\n` +
            `🏢 ${settings.name}\n\n` +
            `Nos vemos lá!`,
        })
      )
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
    const failed = results.length - successful;

    console.log(`⏰ Lembretes: ${successful} enviados, ${failed} falharam`);
  } catch (error) {
    console.error('❌ Erro no job de lembretes:', error);
  }
}

/**
 * Executa job de aniversários manualmente (para teste)
 */
export async function runBirthdayJobNow(): Promise<{ sent: number; failed: number }> {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true, birthdayMessage: true },
  });

  if (!settings) {
    return { sent: 0, failed: 0 };
  }

  const clients = await prisma.client.findMany({
    select: { id: true, fullName: true, phone: true, birthDate: true },
  });

  const birthdayClients = clients.filter((client) => {
    const birthDate = new Date(client.birthDate);
    return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
  });

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
  const failed = results.length - sent;

  return { sent, failed };
}

/**
 * Executa job de lembretes manualmente (para teste)
 */
export async function runReminderJobNow(): Promise<{ sent: number; failed: number }> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayStart = new Date(tomorrow);
  dayStart.setHours(0, 0, 0, 0);

  const dayEnd = new Date(tomorrow);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: dayStart, lte: dayEnd },
      status: 'SCHEDULED',
    },
    include: {
      client: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      employee: { select: { name: true } },
    },
  });

  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  if (!settings) return { sent: 0, failed: 0 };

  const results = await Promise.allSettled(
    appointments.map((apt) =>
      sendWhatsAppMessage({
        phone: apt.client.phone,
        message: `⏰ *Lembrete de Agendamento*\n\n` +
          `Olá ${apt.client.fullName}!\n\n` +
          `Seu agendamento é amanhã:\n` +
          `📅 ${format(apt.startsAt, 'dd/MM/yyyy HH:mm', { timeZone: 'America/Sao_Paulo' })}\n` +
          `✂️ ${apt.service.name}\n` +
          `👤 ${apt.employee.name}\n` +
          `🏢 ${settings.name}\n\n` +
          `Nos vemos lá!`,
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - sent;

  return { sent, failed };
}