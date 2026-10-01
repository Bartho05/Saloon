import cron from 'node-cron';
import prisma from '@config/database';
import { sendBirthdayMessage, sendAppointmentReminder } from './whatsappService';
import { formatInTimeZone } from 'date-fns-tz';
import { record as audit, AuditAction } from './auditService';
import { limpaExpirados } from './verificationCodeService';

const TIMEZONE = 'America/Sao_Paulo';

let birthdayJob: cron.ScheduledTask | null = null;
let reminderJob: cron.ScheduledTask | null = null;
let cleanupJob: cron.ScheduledTask | null = null;

/**
 * Inicia jobs agendados
 */
export function startCronJobs(): void {
  if (process.env.NODE_ENV === 'test') return;

  // Job de aniversários - roda todo dia às 09:00
  birthdayJob = cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('Executando job de aniversários...');
      await processBirthdays();
    },
    { timezone: TIMEZONE }
  );

  // Job de lembretes - roda todo dia às 10:00 (para agendamentos de amanhã)
  reminderJob = cron.schedule(
    '0 10 * * *',
    async () => {
      console.log('Executando job de lembretes...');
      await processReminders();
    },
    { timezone: TIMEZONE }
  );

  /**
   * Faxina diária.
   *
   * Em produção serverless quem dispara esta rotina é o agendador de fora
   * (`GET /api/cron/limpeza`), não este timer — que não sobrevive ao
   * congelamento da função. O código é o mesmo nos dois caminhos.
   */
  cleanupJob = cron.schedule('0 3 * * *', async () => {
    await runCleanupJobNow();
  }, { timezone: TIMEZONE });

  console.log('Jobs agendados iniciados');
}

/**
 * Para jobs agendados
 */
export function stopCronJobs(): void {
  birthdayJob?.stop();
  reminderJob?.stop();
  cleanupJob?.stop();
  birthdayJob = null;
  reminderJob = null;
  cleanupJob = null;
  console.log('Jobs agendados parados');
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
      // Registrar "rodou e não tinha nada" também tem valor: um log de primeira
      // linha mostra que o serviço está vivo. Se só entra quando envia alguma
      // coisa, um job quebrado em silêncio é indistinguível de um dia sem
      // aniversariantes.
      await audit({
        action: AuditAction.CRON_JOB_RUN,
        summary: 'Rotina de aniversários rodou. Nenhum aniversariante hoje',
        entity: 'cron',
        actorKind: 'SYSTEM',
        metadata: { rotina: 'aniversarios', enviados: 0, encontrados: 0 },
      });
      return;
    }

    console.log(`Enviando mensagens para ${birthdayClients.length} aniversariante(s)`);

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
    const falhas = results.length - sent;

    await audit({
      action: AuditAction.CRON_JOB_RUN,
      summary: `Rotina de aniversários: ${sent} mensagem(ns) enviada(s), ${falhas} falha(s)`,
      entity: 'cron',
      actorKind: 'SYSTEM',
      outcome: falhas > 0 ? 'FAILURE' : 'SUCCESS',
      metadata: { rotina: 'aniversarios', enviados: sent, encontrados: birthdayClients.length },
    });
  } catch (error) {
    await audit({
      action: AuditAction.CRON_JOB_FAILED,
      summary: `Rotina de aniversários falhou: ${(error as Error).message}`,
      entity: 'cron',
      actorKind: 'SYSTEM',
      outcome: 'FAILURE',
    });
    console.error('Erro no job de aniversários:', error);
  }
}

/**
 * Processa lembretes de agendamentos para amanhã
 */
async function processReminders(): Promise<void> {
  try {
    const appointments = await findTomorrowAppointments(new Date());

    if (appointments.length === 0) {
      await audit({
        action: AuditAction.CRON_JOB_RUN,
        summary: 'Rotina de lembretes rodou. Nenhum agendamento para amanhã',
        entity: 'cron',
        actorKind: 'SYSTEM',
        metadata: { rotina: 'lembretes', enviados: 0, encontrados: 0 },
      });
      return;
    }

    const settings = await prisma.salonSettings.findUnique({
      where: { id: 1 },
      select: { name: true },
    });

    if (!settings) return;

    console.log(`Enviando ${appointments.length} lembrete(s)`);

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
    const falhas = results.length - sent;

    await audit({
      action: AuditAction.CRON_JOB_RUN,
      summary: `Rotina de lembretes: ${sent} enviado(s), ${falhas} falha(s)`,
      entity: 'cron',
      actorKind: 'SYSTEM',
      outcome: falhas > 0 ? 'FAILURE' : 'SUCCESS',
      metadata: { rotina: 'lembretes', enviados: sent, encontrados: appointments.length },
    });
  } catch (error) {
    await audit({
      action: AuditAction.CRON_JOB_FAILED,
      summary: `Rotina de lembretes falhou: ${(error as Error).message}`,
      entity: 'cron',
      actorKind: 'SYSTEM',
      outcome: 'FAILURE',
    });
    console.error('Erro no job de lembretes:', error);
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

/**
 * Quantos dias de auditoria valem a pena guardar.
 *
 * Três meses atravessa um trimestre inteiro, o que cobre a contabilidade e
 * qualquer disputa sobre um agendamento pontual. Depois disso, apagar é mais
 * sensato que pagar para guardar: a tabela cresce com cada agendamento, cada
 * entrada e cada mensagem de WhatsApp, e ninguém consulta um log de dois anos
 * atrás de um salão.
 *
 * O corte é explícito e registrado no log. Um sumiço de dados sem hora e sem
 * motivo registrado vira mistério quando alguém precisar dele.
 */
export const DIAS_DE_AUDITORIA = 90;

/**
 * Faxina: apaga códigos de verificação vencidos e auditoria antiga.
 *
 * Chamada por dois caminhos — o timer local, que vale para desenvolvimento, e
 * a rota de cron, que é o que roda em produção. A implementação é a mesma, e
 * é ela que registra o resultado.
 */
export async function runCleanupJobNow(): Promise<{
  codigosRemovidos: number;
  registrosRemovidos: number;
}> {
  try {
    const codigos = await limpaExpirados();
    const { count } = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - DIAS_DE_AUDITORIA * 24 * 60 * 60 * 1000) } },
    });

    await audit({
      action: AuditAction.CRON_JOB_RUN,
      summary: `Faxina: ${codigos} código(s) e ${count} registro(s) antigo(s) removidos`,
      entity: 'cron',
      actorKind: 'SYSTEM',
      metadata: {
        rotina: 'limpeza',
        codigosRemovidos: codigos,
        registrosRemovidos: count,
        diasDeAuditoria: DIAS_DE_AUDITORIA,
      },
    });

    return { codigosRemovidos: codigos, registrosRemovidos: count };
  } catch (error) {
    await audit({
      action: AuditAction.CRON_JOB_FAILED,
      summary: `Faxina falhou: ${(error as Error).message}`,
      entity: 'cron',
      actorKind: 'SYSTEM',
      outcome: 'FAILURE',
    });
    throw error;
  }
}
