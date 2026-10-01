import { getWhatsAppConfig, traduzErroZapi, type WhatsAppConfig } from '@config/whatsapp';

/**
 * Cliente da Z-API.
 *
 * ── Sobre o formato da URL ──────────────────────────────────────────────────
 *
 * A Z-API autentica por token NO CAMINHO:
 *
 *   POST https://api.z-api.io/instances/{ID}/token/{TOKEN}/send-text
 *
 * Isto não é um acidente nem uma prática obsoleta: é o contrato documentado
 * deles. Existe também um header `Client-Token`, mas ele serve para uma segunda
 * camada de segurança (o "token de segurança da conta"), não substitui o token
 * da instância. Trocar o caminho por `Authorization: Bearer` faria a integração
 * simplesmente não funcionar.
 *
 * ── Por que um cliente só para a Z-API ──────────────────────────────────────
 *
 * O resto do sistema fala com `sendWhatsAppMessage`, que é genérico. Operar uma
 * instância — pedir o QR Code, checar se está conectada, cadastrar os webhooks —
 * só existe na Z-API. Espalhar essas rotas dentro do controller deixaria o
 *_controller_ falhar inteiro se a Z-API mudasse o formato, e o dono perderia
 * também a Evolution API e a Meta, que continuam funcionando.
 */

/** Erro com o motivo real da Z-API, para aparecer na tela e no log. */
export class ZApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly payload?: unknown
  ) {
    super(message);
    this.name = 'ZApiError';
  }
}

/**
 * Tempo limite de cada chamada.
 *
 * Sem isto, uma Z-API travada segura a requisição até o proxy do Vercel cortar
 * em 10 ou 60 segundos. O dono ficaria olhando um botão "enviar" que não
 * responde, sem nenhuma mensagem. Com 10 segundos, ele recebe um erro que diz
 * o que aconteceu.
 */
const TIMEOUT_MS = 10_000;

/**
 * Desmonta a URL que a Z-API mostra na tela.
 *
 * ── Por que isto existe ────────────────────────────────────────────────────
 *
 * O painel da Z-API não mostra "https://api.z-api.io". Ele mostra a URL
 * inteira, já montada:
 *
 *   https://api.z-api.io/instances/3F9F.../token/60C6.../send-text
 *
 * E é essa URL que a pessoa copia e cola. Foi o que aconteceu na primeira
 * configuração: o campo "URL da API" recebeu o endpoint completo, e o código
 * montou a chamada por cima dele, produzindo isto:
 *
 *   .../send-text/instances/3F9F.../token/60C6.../status
 *
 * A Z-API respondia 404 e a tela dizia "Instance not found" — mensagem
 * verdadeira, que apontava para a coisa errada. Um bug de configuração
 * vestindo roupa de credencial inválida.
 *
 * Aceitar as duas formas é a correção honesta: a forma curta é a que a
 * documentação descreve, e a longa é a que a tela da Z-API entrega. Exigir que
 * a pessoa decifre a URL antes de colar não é validação, é trabalho inútil.
 */
function resolveEndpoint(config: WhatsAppConfig): {
  base: string;
  instanceId: string;
  token: string;
} {
  const bruta = (config.apiUrl || '').trim().replace(/\/+$/, '');

  // Casa `.../instances/{ID}/token/{TOKEN}` no meio ou no fim da URL.
  const Embedded = bruta.match(/^(.*?)\/instances\/([^/]+)\/token\/([^/]+)/);

  if (Embedded) {
    return {
      base: Embedded[1] || 'https://api.z-api.io',
      instanceId: Embedded[2],
      // O token da URL tem prioridade: se a pessoa colou o endpoint que veio da
      // tela, é aquele que está certo.
      token: Embedded[3],
    };
  }

  return {
    base: bruta || 'https://api.z-api.io',
    instanceId: config.instanceId,
    token: config.token,
  };
}

function url(config: WhatsAppConfig, path: string): string {
  const { base, instanceId, token } = resolveEndpoint(config);
  return `${base}/instances/${instanceId}/token/${token}/${path}`;
}

/**
 * Headers de segurança da conta.
 *
 * O `Client-Token` NÃO é opcional na prática. A documentação da Z-API trata
 * como opcional porque o recurso começa desativado, e enquanto desativado a API
 * aceita chamada sem ele. Mas assim que a conta tem o token gerado e ativo, a
 * Z-API recusa toda requisição que não o traga — e a recusa é a mesma para
 * envio, QR Code e consulta de status.
 *
 * Por isso ele vive AQUI, e não em cada função. A primeira versão o enviava
 * só em `sendText`, e o resultado foi um sistema que não enviava mensagem e
 * também não conseguia mostrar o QR Code nem o estado — as três coisas que
 * servem justamente para diagnosticar a falha. Um header esquecido em duas
 * das três chamadas é um botão de diagnóstico quebrado.
 */
function headers(config: WhatsAppConfig, extra: Record<string, string> = {}) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };

  if (config.clientToken) {
    h['Client-Token'] = config.clientToken;
  }

  return h;
}

/** Executa a chamada e traduz falha de rede em erro com mensagem utilizável. */
async function call<T>(
  config: WhatsAppConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url(config, path), {
      ...init,
      // O header de segurança entra AQUI, e não em cada chamador, para que
      // nenhuma rota o esqueça. Um header presente em duas das três chamadas é
      // um botão de diagnóstico quebrado, e foi exatamente o que aconteceu.
      headers: headers(config, (init.headers as Record<string, string>) ?? {}),
      signal: controller.signal,
    });
  } catch (err) {
    const e = err as Error;
    if (e.name === 'AbortError') {
      throw new ZApiError(
        `A Z-API não respondeu em ${TIMEOUT_MS / 1000} segundos. Verifique se o serviço está no ar.`
      );
    }
    throw new ZApiError(
      `Não foi possível falar com a Z-API: ${e.message}. Verifique a URL nas configurações.`
    );
  } finally {
    clearTimeout(timer);
  }

  const texto = await response.text();

  let corpo: any;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    // A Z-API às vezes devolve HTML numa falha de proxy. Um JSON.parse
    // estourando aqui esconderia a mensagem real do erro — o dev ficaria
    // olhando "Unexpected token <" sem nenhuma pista.
    corpo = texto;
  }

  if (!response.ok) {
    const bruto = extrairErro(corpo) ?? `A Z-API respondeu ${response.status}`;
    throw new ZApiError(traduzErroZapi(bruto) ?? bruto, response.status, corpo);
  }

  return corpo as T;
}

/**
 * Puxa a mensagem de erro de onde a Z-API põe.
 *
 * A API usa nomes diferentes conforme o erro e a versão: `error`, `message`,
 * `status`, e o objeto `errors`. Cobrir os quatro é o que faz a tela mostrar
 * "Instância não encontrada" em vez de "Erro 400".
 */
function extrairErro(corpo: any): string | null {
  if (!corpo) return null;
  if (typeof corpo === 'string') return corpo.slice(0, 300);

  for (const chave of ['error', 'message', 'status', 'detail']) {
    const v = corpo[chave];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  if (Array.isArray(corpo.errors) && corpo.errors.length > 0) {
    return corpo.errors.map((e: any) => (typeof e === 'string' ? e : e?.message)).join('; ');
  }

  return null;
}

export interface ZApiStatus {
  /** A instância existe e o token é válido. */
  instanciaExiste: boolean;
  /** O WhatsApp está pareado e pronto para enviar. */
  conectado: boolean;
  /** Celular com o WhatsApp aberto junto, quando a Z-API informa. */
  smartphoneConectado: boolean | null;
  /** Número com DDI, se a Z-API fornecer. */
  numero: string | null;
  /** Nome de quem está logado, quando disponível. */
  pushName: string | null;
  /** Motivo da desconexão, se houver. */
  desconexao: string | null;
  /** Resposta original, para o diagnóstico. */
  bruto: unknown;
}

/**
 * Estado da instância.
 *
 * A pergunta que o dono faz é "está funcionando?", e ela não se responde
 * enviando mensagem de teste: uma mensagem falha porque o celular está sem
 * internet e falha porque o servidor está desconectado — problemas opostos, com
 * consertos opostos. Esta rota lê o estado direto.
 */
export async function status(): Promise<ZApiStatus> {
  const config = await requireConfig();
  const bruto = await call<any>(config, 'status');

  /**
   * `connected` é o que decide, e a Z-API o manda como booleano.
   *
   * As outras formas (string "CONNECTED", campo `state`) ficam por causa de
   * versões diferentes da API, mas a booleana é o que vem hoje — verificado
   * numa conta real.
   *
   * O detalhe que quase passou: a resposta de SUCESSO traz `error:
   * "You are already connected."`. Isto é informação, não problema. O booleano
   * verdadeiro manda, e o texto só vira "desconexão" quando ele é falso.
   * Confundir os dois declararia instância saudável como quebrada.
   */
  const conectado = bruto?.connected === true;
  const motivo = bruto?.error ?? bruto?.status ?? bruto?.state ?? null;

  return {
    instanciaExiste: true,
    conectado,
    smartphoneConectado:
      typeof bruto?.smartphoneConnected === 'boolean' ? bruto.smartphoneConnected : null,
    numero: bruto?.phone ?? bruto?.number ?? null,
    pushName: bruto?.pushName ?? bruto?.pushname ?? null,
    desconexao: conectado ? null : motivo ? String(motivo) : null,
    bruto,
  };
}

export interface ZApiQrCode {
  /** Base64 do PNG, sem o prefixo `data:image/png;base64,`. */
  base64: string | null;
  /** Link alternativo, para o dono abrir no celular em vez de escanear na tela. */
  link: string | null;
  /**
   * A instância já está conectada e por isso não há QR a exibir.
   *
   * Isto NÃO é erro: é o melhor estado possível, e tratá-lo como falha
   * mostrava um cartão vermelho num sistema funcionando — com o dono achando
   * que tinha quebrado alguma coisa.
   */
  jaConectado: boolean;
  bruto: unknown;
}

/**
 * QR Code para parear o celular.
 *
 * Sem isto, conectar o WhatsApp exigiria o painel da Z-API. Com isto, o dono
 * fica dentro do sistema dele: abre a tela, escaneia, pronto.
 */
export async function qrCode(): Promise<ZApiQrCode> {
  const config = await requireConfig();
  const bruto = await call<any>(config, 'qr-code');

  const valor = bruto?.result ?? bruto?.code ?? bruto?.base64 ?? bruto?.qrcode ?? bruto?.value;

  if (typeof valor !== 'string' || !valor) {
    /**
     * A Z-API responde `{ connected: true }` e nenhum QR quando o número já
     * está pareado. É o estado saudável, não uma falha — e é assim que uma
     * conta real respondeu na primeira configuração.
     *
     * A distinção importa: sem ela, a tela de pareamento acusava erro justamente
     * quando não havia nada para consertar.
     */
    if (bruto?.connected === true) {
      return { base64: null, link: null, jaConectado: true, bruto };
    }

    throw new ZApiError(
      'A Z-API não devolveu um QR Code. Se o número ainda não estiver conectado, ' +
        'tente Novamente; se já estiver, o WhatsApp já está pareado.',
      undefined,
      bruto
    );
  }

  return {
    // Alguns retornos trazem o prefixo data URI; o frontend usa só o base64.
    base64: valor.replace(/^data:image\/\w+;base64,/, ''),
    link: bruto?.link ?? bruto?.url ?? null,
    jaConectado: false,
    bruto,
  };
}

/**
 * Cadastra os webhooks da instância.
 *
 * A Z-API é quem PUSH: ela avisa o sistema, o sistema não pergunta. Sem isso o
 * salão descobre que o WhatsApp caiu por um cliente reclamando — e a queda é
 * justamente o que mais importa saber.
 *
 * Só é feito para a Z-API: registrar webhook é conceito dela. Evolution e Meta
 * têm modelos diferentes e não devem receber URL de um formato que não entendem.
 */
export async function configureWebhooks(baseUrl: string): Promise<{ ok: boolean; detalhe: string }> {
  const config = await requireConfig();
  if (config.provider !== 'zapi') {
    return { ok: false, detalhe: 'Cadastro automático de webhook só existe para a Z-API.' };
  }

  const urlWebhook = `${baseUrl.replace(/\/+$/, '')}/api/whatsapp/webhook`;

  try {
    /**
     * PUT, e não POST.
     *
     * Verificado contra a API real: `POST /update-webhooks` responde 405
     * "Method Not Allowed", e `PUT` responde `{"value":true}`. A documentação
     * online mostra o payload em exemplo sem deixar o método explícito, e é
     * fácil assumir POST — que falha silenciosamente do ponto de vista de quem
     * olha a tela, porque o dono só descobre que nada chega quando o cliente
     * reclama.
     *
     * Os três eventos cobrem o que interessa: entrega da mensagem, mudança de
     * status e — o mais importante de todos — a desconexão.
     */
    await call(config, 'update-webhooks', {
      method: 'PUT',
      body: JSON.stringify({
        'on-message-send': urlWebhook,
        'on-whatsapp-message-status-changes': urlWebhook,
        'on-whatsapp-disconnected': urlWebhook,
      }),
    });

    return { ok: true, detalhe: `Avisos registrados. A Z-API avisa ${urlWebhook}` };
  } catch (err) {
    return {
      ok: false,
      detalhe: err instanceof Error ? err.message : 'Falha ao cadastrar os webhooks',
    };
  }
}

/**
 * Envia texto pela Z-API.
 *
 * Devolve o identificador da mensagem porque é ele que amarra o envio ao
 * webhook de entrega: sem o id, a confirmação posterior seria um palpite.
 */
export async function sendText(
  phone: string,
  message: string
): Promise<{ messageId: string | null; bruto: unknown }> {
  const config = await requireConfig();

  const bruto = await call<any>(config, 'send-text', {
    method: 'POST',
    body: JSON.stringify({ phone, message }),
  });

  return {
    messageId: bruto?.messageId ?? bruto?.key?.id ?? bruto?.id ?? null,
    bruto,
  };
}

/** Envia arquivo (usado pela foto do salão, se o dono quiser). */
export async function sendFile(phone: string, url: string, caption?: string): Promise<unknown> {
  const config = await requireConfig();

  return call(config, 'send-file-url', {
    method: 'POST',
    body: JSON.stringify({ phone, url, caption }),
  });
}

async function requireConfig(): Promise<WhatsAppConfig> {
  const config = await getWhatsAppConfig();
  if (!config) {
    throw new ZApiError('WhatsApp não configurado. Preencha instância e token nas configurações do salão.');
  }
  return config;
}
