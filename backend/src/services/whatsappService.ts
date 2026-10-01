import {
  sendWhatsAppMessage,
  sendWhatsAppMessageDetailed,
  getWhatsAppConfig,
  interpolateTemplate,
  clearWhatsAppCache,
} from '@config/whatsapp';
import prisma from '@config/database';

export interface VerificationCodeData {
  phone: string;
  code: string;
}

export interface BirthdayMessageData {
  clientName: string;
  clientPhone: string;
  salonName: string;
  customMessage?: string;
}

export interface AppointmentConfirmationData {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  employeeName: string;
  dateTime: string;
  salonName: string;
}

export interface AppointmentReminderData {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  employeeName: string;
  dateTime: string;
  salonName: string;
}

export interface AppointmentCancellationData {
  clientName: string;
  clientPhone: string;
  serviceName: string;
  dateTime: string;
  salonName: string;
  reason?: string;
}

/**
 * Gera código de verificação de 6 dígitos
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Envia código de verificação por WhatsApp
 *
 * Sempre imprime o código no terminal (útil para desenvolvimento e
 * quando a integração com o WhatsApp não está configurada).
 */
export async function sendVerificationCode(data: VerificationCodeData): Promise<boolean> {
  const isDev = process.env.NODE_ENV !== 'production';
  const config = await getWhatsAppConfig();

  if (!config) {
    console.log('\n══════════════════════════════════════════════');
    console.log('  📱 CÓDIGO DE VERIFICAÇÃO (WhatsApp não configurado)');
    console.log('  Telefone: ' + data.phone);
    console.log('  Código:   ' + data.code);
    console.log('  Expira em 10 minutos');
    console.log('══════════════════════════════════════════════\n');
    return false;
  }

  const message = `Seu código de verificação é: ${data.code}\n\nEste código expira em 10 minutos. Não compartilhe com ninguém.`;
  const sent = await sendWhatsAppMessage({ phone: data.phone, message });

  if (isDev || !sent) {
    console.log('\n══════════════════════════════════════════════');
    console.log('  📱 CÓDIGO DE VERIFICAÇÃO');
    console.log('  Telefone: ' + data.phone);
    console.log('  Código:   ' + data.code);
    console.log('  Enviado via WhatsApp: ' + (sent ? 'SIM' : 'NÃO'));
    console.log('══════════════════════════════════════════════\n');
  }

  return sent;
}

/**
 * Saudação das mensagens.
 *
 * O nome pode vir vazio: um telefone pode ter o cadastro iniciado sem já ter
 * informado o nome. Sem esta guarda a mensagem saía "Olá !" ou "Olá undefined".
 * "tudo bem" funciona em qualquer posição da frase.
 */
function greeting(name: string): string {
  const trimmed = name?.trim();
  return trimmed ? `Olá ${trimmed}!` : 'Olá, tudo bem?';
}

/**
 * Envia confirmação de agendamento
 */
export async function sendAppointmentConfirmation(data: AppointmentConfirmationData): Promise<boolean> {
  const message = `✅ *Agendamento Confirmado*\n\n` +
    `${greeting(data.clientName)}\n\n` +
    `Seu agendamento foi confirmado:\n` +
    `📅 ${data.dateTime}\n` +
    `✂️ ${data.serviceName}\n` +
    `👤 ${data.employeeName}\n` +
    `🏢 ${data.salonName}\n\n` +
    `Se precisar cancelar ou reagendar, avise com pelo menos 2h de antecedência.\n\n` +
    `Obrigado!`;

  return sendWhatsAppMessage({ phone: data.clientPhone, message });
}

/**
 * Envia lembrete de agendamento (1 dia antes)
 */
export async function sendAppointmentReminder(data: AppointmentReminderData): Promise<boolean> {
  const message = `⏰ *Lembrete de Agendamento*\n\n` +
    `${greeting(data.clientName)}\n\n` +
    `Seu agendamento é amanhã:\n` +
    `📅 ${data.dateTime}\n` +
    `✂️ ${data.serviceName}\n` +
    `👤 ${data.employeeName}\n` +
    `🏢 ${data.salonName}\n\n` +
    `Nos vemos lá!`;

  return sendWhatsAppMessage({ phone: data.clientPhone, message });
}

/**
 * Envia notificação de cancelamento
 */
export async function sendAppointmentCancellation(data: AppointmentCancellationData): Promise<boolean> {
  const message = `❌ *Agendamento Cancelado*\n\n` +
    `${greeting(data.clientName)}\n\n` +
    `Seu agendamento foi cancelado:\n` +
    `📅 ${data.dateTime}\n` +
    `✂️ ${data.serviceName}\n` +
    `🏢 ${data.salonName}\n` +
    (data.reason ? `\nMotivo: ${data.reason}` : '') + `\n\n` +
    `Para reagendar, acesse nosso site ou entre em contato.`;

  return sendWhatsAppMessage({ phone: data.clientPhone, message });
}

/**
 * Envia mensagem de aniversário
 */
export async function sendBirthdayMessage(data: BirthdayMessageData): Promise<boolean> {
  const template = data.customMessage || 
    'Olá {nome}! 🎂 Feliz aniversário! Venha comemorar com a gente no {salao} e ganhe um presente especial! 🎁';

  const message = interpolateTemplate(template, {
    // Só chega aqui com nascimento informado (o job filtra null), mas o
    // cadastro pode ter sido zerado no meio do caminho.
    nome: data.clientName?.trim() || 'cliente',
    salao: data.salonName,
  });

  return sendWhatsAppMessage({ phone: data.clientPhone, message });
}

/**
 * Envia código de acesso do funcionário
 */
export async function sendEmployeeAccessCode(phone: string, name: string, accessCode: string, salonName: string): Promise<boolean> {
  const message = `👋 Olá ${name}!\n\n` +
    `Você foi cadastrado como funcionário no *${salonName}*\n\n` +
    `Seu código de acesso: *${accessCode}*\n\n` +
    `Use este código para acessar sua agenda.\n` +
    `Guarde com segurança!`;

  return sendWhatsAppMessage({ phone, message });
}

/**
 * Notifica dono sobre novo agendamento
 */
export async function notifyOwnerNewBooking(
  ownerPhone: string,
  clientName: string,
  serviceName: string,
  employeeName: string,
  dateTime: string,
  salonName: string
): Promise<boolean> {
  const message = `📅 *Novo Agendamento*\n\n` +
    `Cliente: ${clientName?.trim() || 'sem cadastro'}\n` +
    `Serviço: ${serviceName}\n` +
    `Profissional: ${employeeName}\n` +
    `Data/Hora: ${dateTime}\n` +
    `Salão: ${salonName}`;

  return sendWhatsAppMessage({ phone: ownerPhone, message });
}

/**
 * Invalida cache de configuração WhatsApp (chamar quando dono atualiza config)
 */
export function invalidateWhatsAppCache(): void {
  clearWhatsAppCache();
}

/**
 * Testa configuração WhatsApp
 */
export async function testWhatsAppConfig(phone: string): Promise<{ success: boolean; error?: string }> {
  const config = await getWhatsAppConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp não configurado' };
  }

  /**
   * A versão DETALHADA, e não a que devolve só `true`/`false`.
   *
   * Com a booleana, a tela dizia "Falha ao enviar mensagem de teste" para
   * qualquer problema: credencial errada, número desconectado, conta sem
   * saldo. A pessoa então mexia no telefone, quando o defeito estava na
   * configuração — ou o contrário. O motivo da Z-API é a informação útil, e
   * ela estava sendo jogada fora num `false`.
   */
  const resultado = await sendWhatsAppMessageDetailed({
    phone,
    message: 'Teste de configuracao do WhatsApp. Se voce recebeu isto, a integracao esta funcionando.',
  });

  return resultado.ok
    ? { success: true }
    : { success: false, error: resultado.erro ?? 'Falha ao enviar mensagem de teste' };
}