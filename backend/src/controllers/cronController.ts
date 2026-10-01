import { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError, asyncHandler } from '@middlewares/errorHandler';
import { env } from '@config/env';
import { runBirthdayJobNow, runReminderJobNow, runCleanupJobNow } from '@services/cronService';
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';

/**
 * Rotinas disparadas de fora.
 *
 * ── Por que isto existe ────────────────────────────────────────────────────
 *
 * `node-cron` roda dentro do processo. Em desenvolvimento, com um servidor
 * ligado, funciona. Em serverless — Vercel — não: a função é congelada logo
 * depois de responder, e o que estiver no timer dela simplesmente deixa de
 * existir. Um `setInterval` dentro de uma função serverless que roda há três
 * horas nunca chega a disparar.
 *
 * O efeito prático, se nada for feito: o sistema funciona normalmente, os
 * lembretes param de silenciar, os parabéns de aniversário param, e o dono só
 * descobre quando um cliente pergunta "vocês me avisaram do aniversário do meu
 * marido?".
 *
 * ── Como resolver ───────────────────────────────────────────────────────────
 *
 * Quem chama de fora. Duas formas, e as duas passam por estas rotas:
 *
 * 1. **Vercel Cron** — declarativo, em `vercel.json`, sem custo. Dispara uma
 *    requisição GET no horário. É o caminho recomendado.
 * 2. **Qualquer agendador externo** — cron-job.org, UptimeRobot, um cron do
 *    próprio servidor. Mesmo contrato, mesma rota.
 *
 * ── Por que o segredo no header e não na URL ────────────────────────────────
 *
 * A URL aparece em log de acesso, em histórico do navegador e no painel do
 * Vercel. Uma chave de agendamento em `/api/cron/aniversarios?key=...` é
 * pública para quem olhar o log. No header, não. E a comparação é de tempo
 * constante, pelo mesmo motivo do código de acesso do superadmin.
 */
function autorizaCron(req: Request): void {
  const segredo = env.CRON_SECRET;

  /**
   * Sem segredo configurado, a rota não existe.
   *
   * O comportamento alternativo seria deixar aberto "porque é só uma rotina
   * interna" — e aí qualquer pessoa na internet dispara a rotina de
   * aniversário quando quiser, gastando a cota de mensagens da Z-API com o
   * número do salão. Fechar por configuração ausente é o único jeito de não
   * depender de o operador ter lido o manual.
   */
  if (!segredo) {
    throw new AppError(
      'Rotinas externas desativadas. Defina CRON_SECRET no servidor para habilitá-las.',
      503,
      'CRON_DISABLED'
    );
  }

  const recebido = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');

  /**
   * Comparação de tempo constante, e o tamanho é comparado antes.
   *
   * `timingSafeEqual` lança se as entradas tiverem tamanhos diferentes, então
   * o tamanho precisa ser conferido antes. Isso já entrega uma informação
   * (o tamanho do segredo), que é irrelevante: o segredo tem dezenas de
   * caracteres, e um atacante que descubra o tamanho não ganhou nada. O que
   * importava era não comparar o conteúdo caractere a caractere, que permitiria
   * descobrir o segredo um pedaço por tentativa.
   */
  const a = Buffer.from(recebido);
  const b = Buffer.from(segredo);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    void registrarRecusa(req);
    throw new AppError('Não autorizado', 401, 'UNAUTHORIZED');
  }
}

async function registrarRecusa(req: Request): Promise<void> {
  await audit.record(
    {
      action: AuditAction.CRON_JOB_FAILED,
      summary: 'Alguém tentou disparar uma rotina sem a chave correta',
      entity: 'cron',
      outcome: 'FAILURE',
      actorKind: 'ANONYMOUS',
      metadata: { rota: req.path, origem: req.get('user-agent') ?? null },
    },
    audit.auditContextFrom(req)
  );
}

/**
 * GET /api/cron/aniversarios
 *
 * `GET`, e não `POST`, porque o Vercel Cron só faz GET. A rota de verdade
 * muda dados, e aceitar GET para mudar dados é a origem clássica de
 * "?debug=1" disparando coisa em produção. O `CRON_SECRET` é o que fecha essa
 * porta — e ele não está na URL, então não vaza por link clicado.
 */
export const cronAniversarios = asyncHandler(async (req: Request, res: Response) => {
  autorizaCron(req);
  const resultado = await runBirthdayJobNow();
  res.json({ rotina: 'aniversarios', ...resultado });
});

/** GET /api/cron/lembretes */
export const cronLembretes = asyncHandler(async (req: Request, res: Response) => {
  autorizaCron(req);
  const resultado = await runReminderJobNow();
  res.json({ rotina: 'lembretes', ...resultado });
});

/**
 * GET /api/cron/limpeza
 *
 * Apaga códigos de verificação vencidos e auditoria com mais de 90 dias.
 *
 * Às 3h da manhã, de propósito: é quando ninguém está agendando, e é quando
 * apagar um monte de linha custa menos para o banco — inclusive para a agenda
 * de quem está com a tela aberta.
 */
export const cronLimpeza = asyncHandler(async (req: Request, res: Response) => {
  autorizaCron(req);
  const resultado = await runCleanupJobNow();
  res.json({ rotina: 'limpeza', ...resultado });
});
