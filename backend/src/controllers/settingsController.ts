import { Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import { updateSettingsSchema } from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import { invalidateWhatsAppCache, testWhatsAppConfig } from '@services/whatsappService';
import { runBirthdayJobNow, runReminderJobNow } from '@services/cronService';
import { getOwnerFinancialOverview } from '@services/financialService';
import { persistImage, removeImage } from '@services/uploadService';

type WhatsappConfig = {
  provider?: string;
  instanceId?: string;
  token?: string;
  apiUrl?: string;
} | null;

/** Remove a credencial do WhatsApp da resposta e informa se está configurado */
function sanitizeSettings<T extends { whatsappApiConfig?: unknown }>(settings: T) {
  const { whatsappApiConfig, ...safe } = settings;
  const config = (whatsappApiConfig ?? null) as WhatsappConfig;
  return {
    settings: {
      ...safe,
      whatsappConfigured: Boolean(config?.instanceId && config?.token),
    },
  };
}

/**
 * GET /employee/salon
 * Dados públicos do salão, visíveis ao funcionário logado.
 */
export async function getSalonForEmployee(req: AuthRequest, res: Response): Promise<void> {
  let settings = await prisma.salonSettings.findUnique({ where: { id: 1 } });

  if (!settings) {
    settings = await prisma.salonSettings.create({
      data: {
        id: 1,
        name: 'Meu Salão',
        businessHours: {},
      },
    });
  }

  res.json(sanitizeSettings(settings));
}

/**
 * PATCH /employee/salon
 * funcionário atualiza apenas a identidade do salão.
 * Os campos operacionais são filtrados pelo schema antes de chegar aqui.
 */
export async function updateSalonByEmployee(req: AuthRequest, res: Response): Promise<void> {
  const data = {
    ...req.body,
    email: req.body.email || null,
  };

  const settings = await prisma.salonSettings.update({
    where: { id: 1 },
    data,
  });

  res.json(sanitizeSettings(settings));
}

/**
 * POST /employee/salon/logo
 */
export async function uploadSalonLogoByEmployee(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError('Envie um arquivo de imagem', 400, 'FILE_REQUIRED');
  }

  const current = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { logoUrl: true },
  });

  const logoUrl = persistImage(file.path, 'salon', 'logo');
  removeImage(current?.logoUrl);

  const settings = await prisma.salonSettings.update({
    where: { id: 1 },
    data: { logoUrl },
  });

  res.json(sanitizeSettings(settings));
}

/**
 * POST /owner/settings/logo
 * Envia o logo do salão. Aceita owner e funcionário (ambos mantêm os dados
 * do salão atualizados).
 */
export async function uploadSalonLogo(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    throw new AppError('Envie um arquivo de imagem', 400, 'FILE_REQUIRED');
  }

  const current = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { logoUrl: true },
  });

  const logoUrl = persistImage(file.path, 'salon', 'logo');

  // só remove a imagem antiga depois que a nova foi gravada com sucesso
  removeImage(current?.logoUrl);

  const settings = await prisma.salonSettings.update({
    where: { id: 1 },
    data: { logoUrl },
  });

  res.json(sanitizeSettings(settings));
}

/**
 * POST /owner/settings/logo/remove
 * Remove o logo e volta ao inicial (letra).
 */
export async function removeSalonLogo(req: AuthRequest, res: Response): Promise<void> {
  const current = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { logoUrl: true },
  });

  removeImage(current?.logoUrl);

  const settings = await prisma.salonSettings.update({
    where: { id: 1 },
    data: { logoUrl: null },
  });

  res.json(sanitizeSettings(settings));
}

/**
 * GET /owner/settings
 * Busca configurações do salão
 */
export async function getSettings(req: AuthRequest, res: Response): Promise<void> {  let settings = await prisma.salonSettings.findUnique({
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
  res.json(sanitizeSettings(settings));
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

  res.json(sanitizeSettings(settings));
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
  const result = await runBirthdayJobNow();
  res.json({ message: 'Job executado', ...result });
}

/**
 * POST /owner/settings/run-reminder-job
 * Executa job de lembretes manualmente (para teste)
 */
export async function runReminderJob(req: AuthRequest, res: Response): Promise<void> {
  const result = await runReminderJobNow();
  res.json({ message: 'Job executado', ...result });
}

/**
 * GET /owner/financial
 * Visão consolidada do faturamento do salão, por período e por funcionário.
 */
export async function getFinancialOverview(req: AuthRequest, res: Response): Promise<void> {
  const { period = 'month', reference } = req.query as {
    period?: 'day' | 'month' | 'year';
    reference?: Date;
  };

  const overview = await getOwnerFinancialOverview(
    period,
    reference ?? new Date()
  );

  res.json({ financial: overview });
}