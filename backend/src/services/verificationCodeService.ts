import crypto from 'node:crypto';
import prisma from '@config/database';

/**
 * Códigos de verificação do cliente.
 *
 * ── Por que no banco e não em memória ───────────────────────────────────────
 *
 * A primeira versão guardava os códigos num `Map` do processo. Em
 * desenvolvimento, sem problema. Em serverless — que é onde este sistema vai
 * rodar — cada instância tem a sua própria memória: o `POST /request-code`
 * poderia ser atendido pela instância A e o `POST /verify-code` pela B, e o
 * cliente receberia um código que o sistema "não conhecia". Só apareceria depois
 * do deploy, e intermitente, que é a pior forma de bug.
 *
 * ── Por que hash e não o código em texto ────────────────────────────────────
 *
 * Ser honesto sobre o limite: um hash de 6 dígitos com o telefone do lado não
 * segura quem já leu a tabela — um milhão de SHA-256 é instantâneo. O que
 * segura são as três medidas em volta: expira em 10 minutos, some depois de um
 * uso, e conta as tentativas erradas.
 *
 * O hash não é decorativo, mas também não é a proteção principal. Confundir as
 * duas coisas é o erro clássico: achar que está protegido por causa do SHA-256
 * e descobrir depois que o problema era outro.
 */

/** Janela de validade do código. Dez minutos é o padrão do mercado. */
const VALIDADE_MS = 10 * 60 * 1000;

/**
 * Tentativas erradas antes de o código ser descartado.
 *
 * Cinco é o ponto em que a conta está mais protegida sem o usuário desistir:
 * acima de três já é improvável ser erro de digitação — seis dígitos, o cliente
 * tem o texto na tela para comparar.
 */
export const MAX_TENTATIVAS = 5;

function hashCodigo(phone: string, code: string): string {
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

/** Só dígitos, para o telefone casar com o que está gravado no cliente. */
export function normalizaTelefone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Guarda um código novo, descartando os anteriores do mesmo telefone.
 *
 * Descartar em vez de accumulating evita que existam três códigos válidos ao
 * mesmo tempo — o que faria um clienteastaque com o pedido de ontem. O custo é
 * o dono ter de pedir o código de novo se pedir duas vezes seguidas, o que é
 * preferível a um segundo acesso válido que ninguém mandou cancelar.
 */
export async function guarda(phone: string, code: string): Promise<void> {
  const p = normalizaTelefone(phone);

  await prisma.$transaction([
    prisma.verificationCode.deleteMany({ where: { phone: p } }),
    prisma.verificationCode.create({
      data: {
        phone: p,
        codeHash: hashCodigo(p, code),
        expiresAt: new Date(Date.now() + VALIDADE_MS),
      },
    }),
  ]);

  // Faxina do que já não serve para ninguém. Feita aqui e não por cron porque
  // a tabela só cresce quando alguém pede código, e é exatamente nesse momento
  // que o volume antigo pode ser descartado.
  await prisma.verificationCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export type Verificacao =
  | { ok: true }
  | { ok: false; motivo: 'NAO_PEDIDO' | 'EXPIRADO' | 'ERRADO' | 'ESGOTADO' };

/**
 * Confere o código.
 *
 * Devolve um motivo distinguível de propósito: a resposta ao cliente é a mesma
 * para "não pedido", "expirado" e "errado" — confirmar qual dos três é
 * confirmaria que aquele número tem conta. Mas o dono precisa do motivo exato
 * no log, e são correções diferentes.
 *
 * some ao errar de propósito: as tentativas são contadas no registro, e um
 * código com cinco erros não é mais útil para ninguém — nem para quem está
 * digitando certo no quinto erro.
 */
export async function verifica(phone: string, code: string): Promise<Verificacao> {
  const p = normalizaTelefone(phone);

  const registro = await prisma.verificationCode.findFirst({
    where: { phone: p, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!registro) {
    // Pode existir um expirado: nesse caso o motivo certo é "expirado", e
    // dizer "não pedido" mandaria o cliente pedir de novo em vez de entender
    // que o tempo acabou.
    const expirado = await prisma.verificationCode.findFirst({
      where: { phone: p },
      orderBy: { createdAt: 'desc' },
    });

    if (expirado) {
      await prisma.verificationCode.deleteMany({ where: { phone: p } });
      return { ok: false, motivo: 'EXPIRADO' };
    }

    return { ok: false, motivo: 'NAO_PEDIDO' };
  }

  if (registro.attempts >= MAX_TENTATIVAS) {
    await prisma.verificationCode.deleteMany({ where: { phone: p } });
    return { ok: false, motivo: 'ESGOTADO' };
  }

  /**
   * Comparação de tempo constante.
   *
   * Na prática, com 6 dígitos e 5 tentativas, alguém medindo a diferença entre
   * "acertou o primeiro caractere" e "não acertou nenhum" precisaria de milhares
   * de requisições por tentativa, e o contador de tentativas bloquearia antes.
   * Ainda assim, comparar hash de autenticação com `===` é o tipo de coisa que
   * vira vulnfindada anos depois num sistema que cresceu. Custa duas linhas.
   */
  const esperado = Buffer.from(registro.codeHash, 'hex');
  const recebido = Buffer.from(hashCodigo(p, code), 'hex');
  const conferido =
    esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido);

  if (!conferido) {
    const restam = MAX_TENTATIVAS - (registro.attempts + 1);

    // No último erro, apaga: não adianta guardar um código que ninguém mais
    // pode acertar.
    if (restam <= 0) {
      await prisma.verificationCode.deleteMany({ where: { phone: p } });
    } else {
      await prisma.verificationCode.update({
        where: { id: registro.id },
        data: { attempts: { increment: 1 } },
      });
    }

    return { ok: false, motivo: 'ERRADO' };
  }

  // Uso único: o código morre no acerto, mesmo que o cliente feche a tela e
  // tente de novo. Reenviar o mesmo código dois segundos depois é o padrão de
  // quem está tentando interceptar a sessão.
  await prisma.verificationCode.deleteMany({ where: { phone: p } });

  return { ok: true };
}

/** Remove os códigos pendentes de um telefone. Usado ao cancelar o pedido. */
export async function descarta(phone: string): Promise<void> {
  await prisma.verificationCode.deleteMany({ where: { phone: normalizaTelefone(phone) } });
}

/** Apaga tudo que já expirou. Chamado pelo job de limpeza. */
export async function limpaExpirados(): Promise<number> {
  const { count } = await prisma.verificationCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}
