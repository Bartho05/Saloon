import { Request, Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import { updateSettingsSchema } from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import { invalidateWhatsAppCache, testWhatsAppConfig } from '@services/whatsappService';
import { runBirthdayJobNow, runReminderJobNow } from '@services/cronService';
import { getOwnerFinancialOverview } from '@services/financialService';
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';

type WhatsappConfig = {
  provider?: string;
  instanceId?: string;
  token?: string;
  apiUrl?: string;
  clientToken?: string;
} | null;

/**
 * O que o dono precisa ver da configuração do WhatsApp, sem o segredo.
 *
 * A versão anterior devolvia só um booleano "está configurado". Com isso, a
 * tela mostrava os campos vazios, e o dono que abrisse a aba e clicasse em
 * salvar APAGAVA a configuração que estava funcionando — sem nunca ter visto
 * os valores, e sem como recuperá-los.
 *
 * Agora volta o suficiente para reconhecer a configuração (provedor, instância,
 * URL, se há token) e o dono edita só o que quiser mudar. O token nunca sai: a
 * tela sabe que ele existe, não o que é.
 */
function sanitizeSettings<T extends { whatsappApiConfig?: unknown }>(settings: T) {
  const { whatsappApiConfig, ...safe } = settings;
  const config = (whatsappApiConfig ?? null) as WhatsappConfig;

  return {
    settings: {
      ...safe,
      whatsappConfigured: Boolean(config?.instanceId && config?.token),
      whatsapp: {
        provider: config?.provider ?? null,
        instanceId: config?.instanceId ?? null,
        apiUrl: config?.apiUrl ?? null,
        // Só a existência, nunca o valor.
        temToken: Boolean(config?.token),
        temTokenDeSeguranca: Boolean(config?.clientToken),
      },
    },
  };
}

/**
 * GET /public/salon
 * Dados que a landing page exibe: nome, contato, endereço, descrição e
 * horário. Vem do MESMO registro que o dono edita em Configurações — a
 * página pública não pode ter cópia própria dos dados, senão divergem.
 *
 * Não expõe whatsappApiConfig: são credenciais de terceiro.
 */
export async function getPublicSalon(req: Request, res: Response): Promise<void> {
  let settings = await prisma.salonSettings.findUnique({ where: { id: 1 } });

  if (!settings) {
    settings = await prisma.salonSettings.create({
      data: { id: 1, name: 'Meu Salão', businessHours: {} },
    });
  }

  res.json({
    salon: {
      name: settings.name,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      description: settings.description,
      businessHours: settings.businessHours,
    },
  });
}

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
  res.json(sanitizeSettings(settings));
}

/**
 * PATCH /owner/settings
 * Atualiza configurações do salão
 */
export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  const data = { ...req.body };

  const antes = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: {
      name: true,
      phone: true,
      email: true,
      address: true,
      description: true,
      cancellationHours: true,
      bufferMinutes: true,
      slotInterval: true,
      businessHours: true,
      whatsappApiConfig: true,
    },
  });

  /**
   * Token vazio significa "não mexe no que já está".
   *
   * Sem esta regra, salvar qualquer outro campo da tela mandava
   * `whatsappApiConfig` com os campos em branco — porque o token nunca volta
   * para o navegador — e o banco gravava a configuração por cima, apagando um
   * WhatsApp que estava funcionando. O dono veria as mensagens pararem de sair
   * sem ter feito nada de errado.
   *
   * Só o token tem este tratamento. Instância e URL podem ser limpas de
   * propósito, e não há como distinguir "esqueci de preencher" de "quero
   * remover" num campo de texto.
   */
  if (data.whatsappApiConfig) {
    const config = { ...(data.whatsappApiConfig as WhatsappConfig) };
    const antiga = (antes?.whatsappApiConfig ?? null) as WhatsappConfig;

    if (!config.token?.trim() && antiga?.token) {
      config.token = antiga.token;
    }
    if (!config.clientToken?.trim() && antiga?.clientToken) {
      config.clientToken = antiga.clientToken;
    }

    data.whatsappApiConfig = config;
  }

  const settings = await prisma.salonSettings.update({
    where: { id: 1 },
    data,
  });

  // Invalida cache WhatsApp se config mudou
  if (data.whatsappApiConfig) {
    invalidateWhatsAppCache();
  }

  /**
   * Configuração é onde mora a regra do salão, e é a parte que mais causa
   * mal-entendido depois: "por que o sistema bloqueou aquele horário?" é quase
   * sempre o `bufferMinutes` ou o `cancellationHours` mudados sem que ninguém
   * perceba. Por isso o antes e o depois, campo a campo.
   */
  const CABELHO: Record<string, string> = {
    name: 'o nome',
    phone: 'o telefone',
    email: 'o e-mail',
    address: 'o endereço',
    description: 'a descrição',
    cancellationHours: 'a antecedência para cancelar',
    bufferMinutes: 'o intervalo entre atendimentos',
    slotInterval: 'o espaço entre horários',
  };

  const alteracoes: Record<string, { de: unknown; para: unknown }> = {};
  for (const [chave, para] of Object.entries(data)) {
    if (chave === 'whatsappApiConfig' || chave === 'businessHours') continue;
    if (!(chave in CABELHO)) continue;
    if (antes?.[chave as keyof typeof antes] === para) continue;
    alteracoes[chave] = { de: antes?.[chave as keyof typeof antes] ?? null, para: para ?? null };
  }

  if (Object.keys(alteracoes).length > 0) {
    const campos = Object.keys(alteracoes)
      .map((c) => CABELHO[c] ?? c)
      .join(', ');

    await audit.record(
      {
        action: AuditAction.SETTINGS_UPDATED,
        summary: `Alterou ${campos}`,
        entity: 'settings',
        entityId: '1',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { alteracoes },
      },
      audit.auditContextFrom(req)
    );
  }

  /**
   * Horário de funcionamento vai em registro próprio.
   *
   * É um objeto com sete dias, e compará-lo inteiro produziria um bloco de JSON
   * ilegível. O que interessa é quais dias mudaram e para que horário — e essa
   * é também a informação que explica o gráfico financeiro mostrar fewer bars:
   * um dia fechado não gera barra nenhuma, por desenho.
   */
  if (data.businessHours) {
    const antesHoras = (antes?.businessHours ?? {}) as Record<string, unknown>;
    const agoraHoras = data.businessHours as Record<string, unknown>;
    const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    const diasMudados = Object.keys(agoraHoras).filter(
      (dia) => JSON.stringify(antesHoras[dia]) !== JSON.stringify(agoraHoras[dia])
    );

    if (diasMudados.length > 0) {
      const descrever = (v: unknown) => {
        const h = v as { open?: string; close?: string } | null;
        return h?.open && h?.close ? `${h.open} às ${h.close}` : 'fechado';
      };

      await audit.record(
        {
          action: AuditAction.SETTINGS_UPDATED,
          summary: `Alterou o horário de ${diasMudados
            .map((d) => DIAS[Number(d)] ?? d)
            .join(', ')}`,
          entity: 'settings',
          entityId: '1',
          actorKind: 'OWNER',
          actorId: req.user?.sub ?? null,
          metadata: {
            dias: diasMudados.map((d) => ({
              dia: DIAS[Number(d)] ?? d,
              de: descrever(antesHoras[d]),
              para: descrever(agoraHoras[d]),
            })),
          },
        },
        audit.auditContextFrom(req)
      );
    }
  }

  /**
   * A credencial do WhatsApp entra em registro separado e nunca em texto.
   *
   * O dono precisa saber que a configuração mudou, e com isso basta. Nem
   * fragmento do token vai para o log: ele já está no banco, e um log de
   * auditoria é justamente o lugar onde ninguém deveria encontrar segredo.
   */
  if (data.whatsappApiConfig) {
    const config = data.whatsappApiConfig as WhatsappConfig;
    await audit.record(
      {
        action: AuditAction.WHATSAPP_CONFIG_CHANGED,
        summary: config?.token
          ? 'Atualizou a configuração do WhatsApp'
          : 'Removeu a configuração do WhatsApp',
        entity: 'whatsapp',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: {
          provedor: config?.provider ?? null,
          instancia: config?.instanceId ?? null,
          // Chaveado, não o token: a tela só precisa mostrar um "campo
          // preenchido" do lado do campo de texto.
          campos: {
            instancia: Boolean(config?.instanceId),
            token: Boolean(config?.token),
            tokenDeSeguranca: Boolean(config?.clientToken),
          },
        },
      },
      audit.auditContextFrom(req)
    );
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
    await audit.record(
      {
        action: AuditAction.WHATSAPP_SENT,
        summary: 'Enviou uma mensagem de teste pelo WhatsApp',
        entity: 'whatsapp',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { telefone: phone, uso: 'teste de configuração' },
      },
      audit.auditContextFrom(req)
    );

    res.json({ success: true, message: 'Mensagem de teste enviada com sucesso' });
  } else {
    /**
     * Falha de WhatsApp entra no log com o motivo devolvido pela Z-API.
     *
     * É a linha que economiza mais tempo de suporte: "não recebi a mensagem"
     * vira, no log, "token inválido" ou "instância desconectada" — que são
     * problemas diferentes, com correções diferentes.
     */
    await audit.record(
      {
        action: AuditAction.WHATSAPP_FAILED,
        summary: `Falha no teste do WhatsApp: ${result.error}`,
        entity: 'whatsapp',
        outcome: 'FAILURE',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
        metadata: { telefone: phone, uso: 'teste de configuração' },
      },
      audit.auditContextFrom(req)
    );

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
    /** 'YYYY-MM-DD' crua: a conversão para o fuso do salão é do serviço. */
    reference?: string;
  };

  const overview = await getOwnerFinancialOverview(period, reference);

  res.json({ financial: overview });
}
