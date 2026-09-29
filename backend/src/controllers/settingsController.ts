import { Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import { updateSettingsSchema } from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import { invalidateWhatsAppCache, testWhatsAppConfig } from '@services/whatsappService';

/**
 * GET /owner/settings
 * Busca configurações do salão
 */
export async function getSettings(req: AuthRequest, res: Response): Promise<void> {
  let settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
  });

  // Se não existe, cria padrão
  if (!settings) {
    settings = await prisma.salonSettings.create({
      data: {
        id: 1,
        name: 'Meu Salão',
        businessHours: {
          0: null,
          1: { open: '09:00', close: '19:00' },
          2: { open: '09:00', close: '19:00' },
          3: { open: '09:00', close: '19:00' },
          4: { open: '09:00', close: '19:00' },
          5: { open: '09:00', close: '19:00' },
          6: { open: '09:00', close: '17:00' },
        },
        birthdayMessage: 'Olá {nome}! 🎂 Feliz aniversário! Venha comemorar com a gente no {salao} e ganhe um presente especial! 🎁',
        cancellationHours: 2,
        bufferMinutes: 10,
        slotInterval: 30,
      },
    });
  }

  // Remove config sensível do WhatsApp do response
  const { whatsappApiConfig, ...safeSettings } = settings;

  res.json({
    settings: {
      ...safeSettings,
      whatsappConfigured: !!whatsappApiConfig?.instanceId && !!whatsappApiConfig?.token,
    },
  });
}

/**
 * PATCH /owner/settings
 * Atualiza configurações do salão
 */
export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  const data = req.body;

  const settings = await prisma.salonSettings.update({
    where: { id: 1 },
    data,
  });

  // Invalida cache WhatsApp se config mudou
  if (data.whatsappApiConfig) {
    invalidateWhatsAppCache();
  }

  const { whatsappApiConfig, ...safeSettings } = settings;

  res.json({
    settings: {
      ...safeSettings,
      whatsappConfigured: !!whatsappApiConfig?.instanceId && !!whatsappApiConfig?.token,
    },
  });
}

/**
 * POST /owner/settings/test-whatsapp
 * Testa configuração do WhatsApp
 */
export async function testWhatsApp(req: AuthRequest, res: Response): Promise<void> {
  const { phone } = req.body;

  if (!phone) {
    throw new AppError('Telefone para teste é obrigatório', 400, 'PHONE_REQUIRED');
  }

  const result = await testWhatsAppConfig(phone);

  if (result.success) {
    res.json({ success: true, message: 'Mensagem de teste enviada com sucesso' });
  } else {
    res.status(400).json({ success: false, error: result.error });
  }
}

/**
 * POST /owner/settings/run-birthday-job
 * Executa job de aniversários manualmente (para teste)
 */
export async function runBirthdayJob(req: AuthRequest, res: Response): Promise<void> {
  const { runBirthdayJobNow } = await import('@services/cronService');
  const result = await runBirthdayJobNow();
  res.json({ message: 'Job executado', ...result });
}

/**
 * POST /owner/settings/run-reminder-job
 * Executa job de lembretes manualmente (para teste)
 */
export async function runReminderJob(req: AuthRequest, res: Response): Promise<void> {
  const { runReminderJobNow } = await import('@services/cronService');
  const result = await runReminderJobNow();
  res.json({ message: 'Job executado', ...result });
}