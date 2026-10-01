import { env } from './env';
import prisma from './database';

export interface WhatsAppConfig {
  provider: 'zapi' | 'evolution' | 'meta';
  instanceId: string;
  token: string;
  apiUrl: string;
  /**
   * Token de segurança da conta Z-API (opcional).
   *
   * A Z-API tem duas credenciais: o token DA INSTÂNCIA, que vai no caminho da
   * URL e é obrigatório, e o token DE SEGURANÇA DA CONTA, que vai no header
   * `Client-Token`. O segundo, se configurado, faz a API recusar chamadas
   * vindas de IP não cadastrado — é o que impede alguém que descubra a URL da
   * instância de mandar mensagem em nome do salão.
   */
  clientToken?: string;
}

export interface SendMessageParams {
  phone: string;
  message: string;
}

let cachedConfig: WhatsAppConfig | null = null;
let cacheEm = 0;

/**
 * Validade do cache: 60 segundos.
 *
 * Em desenvolvimento, invalidar na hora resolvia. Em produção com mais de uma
 * instância, não: a instância que atendeu a tela de configurações tem a
 * configuração nova em memória, e as outras três continuam com a antiga — e a
 * diferença só aparece como "às vezes o WhatsApp não manda".
 *
 * 60s é imperceptível para o dono earante que a troca propaga sozinha.
 */
const CACHE_MS = 60_000;

export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  if (cachedConfig && Date.now() - cacheEm < CACHE_MS) return cachedConfig;

  // Primeiro tenta pegar do .env
  if (env.WHATSAPP_INSTANCE_ID && env.WHATSAPP_TOKEN) {
    cachedConfig = {
      provider: env.WHATSAPP_PROVIDER,
      instanceId: env.WHATSAPP_INSTANCE_ID,
      token: env.WHATSAPP_TOKEN,
      apiUrl: env.WHATSAPP_API_URL,
      clientToken: env.WHATSAPP_CLIENT_TOKEN,
    };
    cacheEm = Date.now();
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
      cachedConfig = {
        ...config,
        // Preenche o que faltar: uma configuração salva antes de existir o
        // campo `clientToken`, ou com a URL em branco, não pode fazer a
        // integração parar de funcionar.
        apiUrl: config.apiUrl || env.WHATSAPP_API_URL,
        provider: config.provider || 'zapi',
      };
      cacheEm = Date.now();
      return cachedConfig;
    }
  }

  return null;
}

export function clearWhatsAppCache(): void {
  cachedConfig = null;
  cacheEm = 0;
}

/** Resultado do envio, com o motivo quando falha. */
export interface SendResult {
  ok: boolean;
  /** Motivo legível da falha. Já é o que a Z-API respondeu, não um genérico. */
  erro?: string;
  /** Id da mensagem na Z-API, para amarrar o webhook de entrega posterior. */
  messageId?: string | null;
}

/**
 * Tempo limite de qualquer chamada ao provedor.
 *
 * Sem isto a requisição fica pendurada enquanto a API não responder, e o dono
 * vê o botão girar até o proxy cortar a conexão do nada. Dez segundos dão
 * tempo de sobra e produzem uma mensagem de erro utilizável.
 */
const TIMEOUT_MS = 10_000;

/**
 * Envia mensagem e devolve o motivo da falha.
 *
 * Antes isto devolvia só `true`/`false`. Com só isso, "WhatsApp não
 * configurado", "token inválido" e "instância desconectada" viravam a mesma
 * linha no log, e o dono ficava sem pista de onde olhar. A auditoria só é útil
 * se o motivo vier junto.
 */
/**
 * Desmonta a URL da Z-API em base, instância e token.
 *
 * A tela da Z-API mostra a URL inteira, já com instância e token dentro:
 *
 *   https://api.z-api.io/instances/{ID}/token/{TOKEN}/send-text
 *
 * É isso que a pessoa copia. Se o código montar a chamada por cima disso, a
 * URL final fica com o caminho repetido, a API devolve 404, e a tela acusa
 * "instância não encontrada" — mensagem verdadeira que aponta para a causa
 * errada.
 *
 * Por isso as duas formas são aceitas: a curta (a que a documentação
 * descreve) e a colada do painel. Exigir que a pessoa decifre a URL antes de
 * preencher não é validação, é trabalho inútil.
 */
function resolveZapiEndpoint(config: WhatsAppConfig): {
  base: string;
  instanceId: string;
  token: string;
} {
  const bruta = (config.apiUrl || '').trim().replace(/\/+$/, '');
  const embutido = bruta.match(/^(.*?)\/instances\/([^/]+)\/token\/([^/]+)/);

  if (embutido) {
    return {
      base: embutido[1] || 'https://api.z-api.io',
      // O que veio na URL tem prioridade: se a pessoa colou o endpoint da tela,
      // é aquele que está certo.
      instanceId: embutido[2],
      token: embutido[3],
    };
  }

  return {
    base: bruta || 'https://api.z-api.io',
    instanceId: config.instanceId,
    token: config.token,
  };
}

export async function sendWhatsAppMessageDetailed(
  params: SendMessageParams
): Promise<SendResult> {
  const config = await getWhatsAppConfig();
  if (!config) {
    return {
      ok: false,
      erro: 'WhatsApp não configurado. Preencha instância e token nas configurações do salão.',
    };
  }

  const formattedPhone = formatPhoneForWhatsApp(params.phone);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let response: Response;

    switch (config.provider) {
      case 'zapi': {
        const { base, instanceId, token } = resolveZapiEndpoint(config);
        response = await fetch(`${base}/instances/${instanceId}/token/${token}/send-text`, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(config.clientToken ? { 'Client-Token': config.clientToken } : {}),
          },
          body: JSON.stringify({
            phone: formattedPhone,
            message: params.message,
          }),
        });
        break;
      }

      case 'evolution':
        response = await fetch(
          `${config.apiUrl.replace(/\/+$/, '')}/message/sendText/${config.instanceId}`,
          {
            method: 'POST',
            signal: controller.signal,
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
          `${config.apiUrl.replace(/\/+$/, '')}/${config.instanceId}/messages`,
          {
            method: 'POST',
            signal: controller.signal,
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
        return { ok: false, erro: `Provedor WhatsApp não suportado: ${config.provider}` };
    }

    const texto = await response.text();

    if (!response.ok) {
      const bruto = extrairErroDaResposta(texto) ?? `O provedor respondeu ${response.status}`;
      return { ok: false, erro: traduzErroZapi(bruto) ?? bruto };
    }

    let corpo: any = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = null;
    }

    // A Z-API devolve 200 com `status: "ERROR"` em alguns casos de
    // desconexão. Sem esta checagem, "desconectado" viraria "enviado".
    if (corpo && (corpo.status === 'ERROR' || corpo.error)) {
      const bruto =
        corpo.message ??
        corpo.error?.message ??
        (typeof corpo.error === 'string' ? corpo.error : 'A Z-API recusou o envio');
      return { ok: false, erro: traduzErroZapi(bruto) ?? bruto };
    }

    return {
      ok: true,
      messageId: corpo?.messageId ?? corpo?.key?.id ?? null,
    };
  } catch (error) {
    const e = error as Error;
    if (e.name === 'AbortError') {
      return {
        ok: false,
        erro: `O provedor de WhatsApp não respondeu em ${TIMEOUT_MS / 1000} segundos.`,
      };
    }
    return { ok: false, erro: `Falha de rede ao falar com o provedor: ${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * O provedor pode responder 4xx/5xx com HTML de proxy, JSON, ou texto puro.
 * Cada formato precisa virar a mesma coisa: uma frase que o dono consiga usar.
 */
function extrairErroDaResposta(texto: string): string | null {
  if (!texto) return null;

  let corpo: any;
  try {
    corpo = JSON.parse(texto);
  } catch {
    // HTML ou texto puro. Corta em 200 caracteres porque a tela mostra isso
    // inteiro, e uma página de erro do proxy não cabe num cartão.
    return texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || null;
  }

  for (const chave of ['message', 'error', 'status', 'detail']) {
    const v = corpo?.[chave];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  return null;
}

/**
 * Traduz os erros de credencial da Z-API em instrução.
 *
 * ── Por que isto não é vaidade ──────────────────────────────────────────────
 *
 * A Z-API responde "your client-token is not configured" a qualquer requisição
 * sem o Token de Segurança da Conta. A mensagem é verdadeira e não diz nada do
 * que fazer: não é problema de instância, não é token errado, não é celular
 * desconectado. Quem lê isso no painel do dono procura três coisas e não acha
 * nenhuma.
 *
 * O caso é comum: qualquer conta Z-API com o recurso de segurança habilitado —
 * que é o padrão do painel — cai nele. Foi o que aconteceu na primeira
 * configuração real deste sistema, e o diagnóstico só foi rápido porque a
 * mensagem foi lida com calma. Traduzir é a diferença entre um minuto de
 * trabalho e um mistério.
 *
 * Fica aqui, e não no `zapi.ts`, porque o envio de mensagem também precisa
 * traduzir, e o `zapi.ts` importa este arquivo — importar de volta criaria
 * ciclo.
 */
export function traduzErroZapi(mensagem: string): string | null {
  const t = mensagem.toLowerCase();

  if (t.includes('client-token') || t.includes('client token')) {
    return (
      'A Z-API exige o Token de Segurança da Conta e ele não está informado. ' +
      'No painel da Z-API, abra Segurança → Token de Segurança da Conta, e cole o token ' +
      'no campo "Token de segurança da conta" em Configurações → WhatsApp. ' +
      `Resposta da Z-API: ${mensagem}`
    );
  }

  if (t.includes('instance not found') || t.includes('instancia nao encontrada')) {
    return (
      'A Z-API não encontrou essa instância. Confira se o Instance ID é o da instância que ' +
      'você criou — ele muda se a instância for recriada. ' +
      `Resposta da Z-API: ${mensagem}`
    );
  }

  if (t.includes('invalid token') || t.includes('token inválido') || t.includes('token invalido')) {
    return (
      'O token da instância não foi aceito. Confira o valor em Instância → Tokens de segurança ' +
      `na Z-API. Resposta da Z-API: ${mensagem}`
    );
  }

  if (t.includes('not connected') || t.includes('desconectad')) {
    return (
      'O número está desconectado do servidor da Z-API. Abra Configurações → WhatsApp, gere o ' +
      `QR Code e escaneie com o celular. Resposta da Z-API: ${mensagem}`
    );
  }

  return null;
}

/**
 * Envia mensagem.
 *
 * Mantém a assinatura booleana porque são doze chamadores esperando isso, e
 * nenhum deles precisa do motivo. Quem precisa chama a versão detalhada.
 */
export async function sendWhatsAppMessage(params: SendMessageParams): Promise<boolean> {
  const resultado = await sendWhatsAppMessageDetailed(params);

  if (!resultado.ok) {
    console.error('WhatsApp não enviado:', resultado.erro);
  }

  return resultado.ok;
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