import { env } from './env';
import prisma from './database';

export interface WhatsAppConfig {
  provider: 'zapi' | 'evolution' | 'meta';
  instanceId: string;
  token: string;
  apiUrl: string;
}

export interface SendMessageParams {
  phone: string;
  message: string;
}

let cachedConfig: WhatsAppConfig | null = null;

export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  if (cachedConfig) return cachedConfig;

  // Primeiro tenta pegar do .env
  if (env.WHATSAPP_INSTANCE_ID && env.WHATSAPP_TOKEN) {
    cachedConfig = {
      provider: env.WHATSAPP_PROVIDER,
      instanceId: env.WHATSAPP_INSTANCE_ID,
      token: env.WHATSAPP_TOKEN,
      apiUrl: env.WHATSAPP_API_URL,
    };
    return cachedConfig;
  }

  // Se não tiver no .env, tenta pegar do banco (configurado pelo dono)
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { whatsappApiConfig: true },
  });

  if (settings?.whatsappApiConfig) {
    const config = settings.whatsappApiConfig as unknown as WhatsAppConfig;
    if (config.instanceId && config.token) {
      cachedConfig = config;
      return cachedConfig;
    }
  }

  return null;
}

export function clearWhatsAppCache(): void {
  cachedConfig = null;
}

export async function sendWhatsAppMessage(params: SendMessageParams): Promise<boolean> {
  const config = await getWhatsAppConfig();
  if (!config) {
    console.warn('⚠️ WhatsApp não configurado. Mensagem não enviada:', params.phone);
    return false;
  }

  const formattedPhone = formatPhoneForWhatsApp(params.phone);

  try {
    let response: Response;

    switch (config.provider) {
      case 'zapi':
        response = await fetch(
          `${config.apiUrl}/instances/${config.instanceId}/token/${config.token}/send-text`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: formattedPhone,
              message: params.message,
            }),
          }
        );
        break;

      case 'evolution':
        response = await fetch(
          `${config.apiUrl}/message/sendText/${config.instanceId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: config.token,
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: params.message,
            }),
          }
        );
        break;

      case 'meta':
        response = await fetch(
          `${config.apiUrl}/${config.instanceId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.token}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: formattedPhone,
              type: 'text',
              text: { body: params.message },
            }),
          }
        );
        break;

      default:
        throw new Error(`Provedor WhatsApp não suportado: ${config.provider}`);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Erro ao enviar WhatsApp:', error);
      return false;
    }

    console.log(`✅ WhatsApp enviado para ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    return false;
  }
}

function formatPhoneForWhatsApp(phone: string): string {
  // Remove tudo que não é número
  const numbers = phone.replace(/\D/g, '');

  // Se já tem código do país (55), retorna como está
  if (numbers.startsWith('55') && numbers.length >= 12) {
    return numbers;
  }

  // Adiciona código do Brasil (55) se não tiver
  if (numbers.length === 10 || numbers.length === 11) {
    return `55${numbers}`;
  }

  return numbers;
}

export function interpolateTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => data[key] || match);
}