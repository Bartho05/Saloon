import { Request, Response } from 'express';
import { AppError } from '@middlewares/errorHandler';
import { AuthRequest } from '@middlewares/auth';
import * as zapi from '@services/zapi';
import { getWhatsAppConfig, clearWhatsAppCache } from '@config/whatsapp';
import { env } from '@config/env';
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';

/**
 * ── Sobre o webhook ─────────────────────────────────────────────────────────
 *
 * A Z-API não é consultada: ela avisa. Quando uma mensagem é entregue, lida ou
 * quando o WhatsApp cai, é a Z-API que chama ESTE endpoint.
 *
 * Três decisões que precisam estar justificadas:
 *
 * 1. **Rota pública.** Não há sessão nem token: quem chama é a Z-API. A
 *    proteção é outra — a rota só escreve no log e não devolve nada. Autorizar
 *    por sessão tornaria o webhook impossível, já que a Z-API não tem login.
 *
 * 2. **Resposta 200 sempre.** A Z-API reenvia quando recebe erro. Se devolvesse
 *    500 por causa de um registro malformado, ela bateria aqui para sempre,
 *    transformando um webhook inútil em um loop de requisições.
 *
 * 3. **Nada de segredo na resposta.** O corpo da resposta é `ok: true` e nada
 *    mais. Mesmo que alguém descubra a URL, não leva informação nenhuma.
 */
/** Só os eventos que o sistema usa. O resto é ignorado, não rejeitado. */
type Evento =
  | 'on-message-send'
  | 'on-whatsapp-message-status-changes'
  | 'on-whatsapp-disconnected';

export function webhooks(req: Request, res: Response): void {
  const corpo = req.body ?? {};
  const tipo = (req.query.type ?? corpo.type ?? corpo.event ?? '') as string;

  /*
   * ÚNICO lugar do sistema que NÃO espera a gravação terminar.
   *
   * Em todos os outros, a auditoria é aguardada: a pessoa acabou de agir e o
   * registro é a prova disso, e esperar custa um INSERT de poucos
   * milissegundos.
   *
   * Aqui é diferente. A Z-API está esperando a resposta, e demora demais faz
   * ela considerar que falhou e reenviar — o que geraria um loop de requisições
   * para um evento que já foi registrado. E o custo de perder UM registro de
   * status de entrega é pequeno ao lado do custo de um webhook que a Z-API
   * desiste de usar. A troca aqui é: 200 imediato, registro por conta própria.
   */

  // A Z-API manda o evento em `type`; algumas versões mandam o corpo inteiro
  // com o nome do evento. Sem isso, cairia no "ignorado" e o dono nunca
  // receberia o alerta de desconexão.
  switch (tipo as Evento) {
    case 'on-whatsapp-disconnected':
      void audit.record({
        action: AuditAction.WHATSAPP_DISCONNECTED,
        summary: 'O WhatsApp foi desconectado. As mensagens pararam de sair',
        entity: 'whatsapp',
        outcome: 'FAILURE',
        actorKind: 'SYSTEM',
        metadata: {
          motivo: corpo.reason ?? corpo.status ?? null,
          // Guarda o contato: é quem vai precisar avisar o dono.
          telefone: corpo.phone ?? null,
        },
      });
      break;

    case 'on-message-send':
    case 'on-whatsapp-message-status-changes':
      /**
       * Entrega e leitura.
       *
       * Vale registrar porque é a diferença entre "o sistema mandou" e "o
       * cliente recebeu". Sem isso, o único sintoma de uma mensagem parada é o
       * cliente dizer que não recebeu — e o dono sem como provar onde parou.
       */
      void audit.record({
        action: AuditAction.WHATSAPP_MESSAGE_STATUS,
        summary: `Mensagem ${traduzirStatus(corpo.status)} (${corpo.status ?? 'sem status'})`,
        entity: 'whatsapp',
        // Falha de entrega é o que interessa, então o resultado reflete isso.
        outcome: ehFalhaDeEntrega(corpo.status) ? 'FAILURE' : 'SUCCESS',
        actorKind: 'SYSTEM',
        metadata: {
          telefone: corpo.phone ?? null,
          status: corpo.status ?? null,
          messageId: corpo.messageId ?? null,
        },
      });
      break;

    default:
      // Evento desconhecido ou não cadastrado. Não é erro: a Z-API pode
      // disparar tipos que este sistema não usa, e recusar faria ela parar de
      // enviar os que interessam.
      break;
  }

  res.status(200).json({ ok: true });
}

/** A Z-API reaproveita os mesmos status do WhatsApp oficial. */
function traduzirStatus(status: unknown): string {
  switch (status) {
    case 'SENT':
      return 'enviada';
    case 'DELIVERY_ACK':
      return 'entregue';
    case 'READ':
      return 'lida';
    default:
      return 'atualizada';
  }
}

/** "Não entregue" é falha mesmo tendo saído da API com sucesso. */
function ehFalhaDeEntrega(status: unknown): boolean {
  if (typeof status !== 'string') return false;
  return ['ERROR', 'FAILED', 'UNDELIVERED'].includes(status.toUpperCase());
}

/**
 * GET /owner/whatsapp/status
 *
 * A pergunta que o dono faz é "está funcionando?", e ela não se responde
 * mandando mensagem de teste: uma mensagem falha porque o celular está sem
 * internet, e falha porque o servidor está desconectado — problemas opostos,
 * com consertos opostos.
 */
export async function status(req: AuthRequest, res: Response): Promise<void> {
  const config = await getWhatsAppConfig();

  if (!config) {
    res.json({
      configurado: false,
      conectado: false,
      mensagem: 'Preencha instância e token nas configurações do salão para ativar o WhatsApp.',
    });
    return;
  }

  try {
    const estado = await zapi.status();

    // Só interessa quando algo está errado: um "conectado" no log de todo dia
    // só dilui o dia em que a queda importa.
    if (!estado.conectado) {
      await audit.record(
        {
          action: AuditAction.WHATSAPP_DISCONNECTED,
          summary: 'O dono abriu o painel e o WhatsApp está desconectado',
          entity: 'whatsapp',
          outcome: 'FAILURE',
          actorKind: 'OWNER',
          actorId: req.user?.sub ?? null,
          metadata: { estado: estado.desconexao },
        },
        audit.auditContextFrom(req)
      );
    }

    /**
     * A mensagem de sucesso não promete mostrar o número.
     *
     * A Z-API não devolve o número em `/status` — a resposta traz só
     * `connected`, `session` e `smartphoneConnected`. A versão anterior
     * escrevia "Conectado no número desconhecido", que soava a defeito quando
     * o sistema estava perfeito: o dono lia "desconhecido" e ia procurar um
     * problema que não existia.
     *
     * A informação que a API dá de útil é o segundo celular: com ele aberto, a
     * Z-API mantém a sessão viva de forma mais estável. Quando ela informa,
     * isso vira nota em vez de número inventado.
     */
    const notas: string[] = [];

    if (estado.smartphoneConectado === true) {
      notas.push('Com o WhatsApp aberto no celular, a sessão fica mais estável.');
    } else if (estado.smartphoneConectado === false) {
      notas.push(
        'O celular não está com o WhatsApp aberto. A sessão pode cair sozinha depois de um tempo.'
      );
    }

    res.json({
      configurado: true,
      conectado: estado.conectado,
      numero: estado.numero,
      pushName: estado.pushName,
      smartphoneConectado: estado.smartphoneConectado,
      mensagem: estado.conectado
        ? ['O WhatsApp está conectado e as mensagens estão saindo.', ...notas].join(' ')
        : `O WhatsApp está desconectado. Motivo informado: ${estado.desconexao ?? 'não informado'}.`,
    });
  } catch (err) {
    // Erro aqui significa problema de CREDENCIAL ou de URL — quase nunca
    // desconexão. A diferença importa porque a solução é outra.
    const mensagem =
      err instanceof Error ? err.message : 'Não foi possível consultar a Z-API';

    await audit.record(
      {
        action: AuditAction.WHATSAPP_FAILED,
        summary: `Falha ao consultar o estado do WhatsApp: ${mensagem}`,
        entity: 'whatsapp',
        outcome: 'FAILURE',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
      },
      audit.auditContextFrom(req)
    );

    // 502, e não 500: a API de terceiro está indisponível, o sistema do salão
    // está de pé. A diferença muda o que se procura.
    throw new AppError(mensagem, 502, 'WHATSAPP_PROVIDER_ERROR');
  }
}

/**
 * GET /owner/whatsapp/qrcode
 *
 * QR Code para parear o celular. Sem esta rota, conectar o WhatsApp exigiria
 * abrir o painel da Z-API numa aba separada; com ela, o dono faz tudo dentro
 * do sistema dele.
 */
export async function qrcode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const qr = await zapi.qrCode();

    /**
     * Já pareado é sucesso, e a tela precisa saber disso.
     *
     * A Z-API devolve `{ connected: true }` sem QR quando o número já está
     * conectado. A versão anterior tratava a ausência de QR como falha, e a
     * tela mostrava um cartão de erro num sistema perfeitamente funcionando —
     * com o dono procurando um problema que não existia.
     */
    res.json({
      base64: qr.base64,
      link: qr.link,
      jaConectado: qr.jaConectado,
      mensagem: qr.jaConectado
        ? 'O número já está conectado. Desconecte no celular (Aparelhos conectados) se quiser parear de novo.'
        : null,
    });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : 'Não foi possível gerar o QR Code';

    await audit.record(
      {
        action: AuditAction.WHATSAPP_FAILED,
        summary: `Não foi possível gerar o QR Code: ${mensagem}`,
        entity: 'whatsapp',
        outcome: 'FAILURE',
        actorKind: 'OWNER',
        actorId: req.user?.sub ?? null,
      },
      audit.auditContextFrom(req)
    );

    throw new AppError(mensagem, 502, 'WHATSAPP_QRCODE_ERROR');
  }
}

/**
 * POST /owner/whatsapp/webhooks/register
 *
 * Cadastra o webhook sozinho, em vez de o dono copiar URL no painel da Z-API.
 *
 * Depende de `BACKEND_URL` estar no `.env`. Sem ela a rota diz exatamente o
 * que falta, em vez de cadastrar um endereço errado — que é o modo mais
 * comum de "configurei o webhook e nunca chegou nada": apontar para
 * `localhost`, que a Z-API não alcança.
 */
export async function registerWebhooks(req: AuthRequest, res: Response): Promise<void> {
  if (!env.BACKEND_URL) {
    throw new AppError(
      'Defina BACKEND_URL no servidor com a URL pública deste backend (ex.: https://api.seudominio.com.br) para registrar os webhooks automaticamente.',
      400,
      'BACKEND_URL_MISSING'
    );
  }

  const resultado = await zapi.configureWebhooks(env.BACKEND_URL);

  await audit.record(
    {
      action: AuditAction.WHATSAPP_CONFIG_CHANGED,
      summary: resultado.ok
        ? 'Registrou os webhooks de entrega e desconexão'
        : `Não conseguiu registrar os webhooks: ${resultado.detalhe}`,
      entity: 'whatsapp',
      outcome: resultado.ok ? 'SUCCESS' : 'FAILURE',
      actorKind: 'OWNER',
      actorId: req.user?.sub ?? null,
      metadata: { detalhe: resultado.detalhe },
    },
    audit.auditContextFrom(req)
  );

  // A configuração do webhook já mudou lá fora; o cache local não muda, mas
  // limpá-lo é barato e evita confusão se a Z-API passar a exigir o token.
  clearWhatsAppCache();

  if (!resultado.ok) {
    throw new AppError(resultado.detalhe, 502, 'WEBHOOK_REGISTER_FAILED');
  }

  res.json({ ok: true, detalhe: resultado.detalhe });
}
