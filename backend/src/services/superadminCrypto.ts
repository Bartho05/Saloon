import { randomBytes, scrypt, timingSafeEqual, createHash, type ScryptOptions } from 'node:crypto';

/**
 * scrypt em forma de Promise.
 *
 * Escrito à mão em vez de `promisify(scrypt)` porque o promisify perde a
 * sobrecarga que aceita as opções: sem o wrapper tipado, os parâmetros de custo
 * seriam marcados como erro de compilação — e é justamente o custo que faz o
 * scrypt valer a pena.
 */
function derive(
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

/**
 * Criptografia do código de acesso do superadmin.
 *
 * ── Por que HASH e não CIFRA ────────────────────────────────────────────────
 *
 * O requisito é "gravado no banco de um jeito que não dê para descobrir". Isso
 * é uma propriedade de mão única por definição. Uma cifra é reversível por
 * projeto: existe a chave, existe a função, e quem tiver um dos dois
 * recupera o texto. Escrever uma cifra própria aqui atenderia ao contrário do
 * pedido — criaria um caminho novo de recuperação e nenhum ganho.
 *
 * Então o que este módulo faz é o que de fato resolve o problema, e resolve
 * com peças primitives já auditadas em vez de matemática de bandeja:
 *
 *  1. **scrypt** — função de derivação resistente a hardware dedicado e à
 *     memória. Mais cara de quebrar do que o SHA puro, que um computador comum
 *     testa bilhões por segundo. O custo só é pago no login, não no sistema.
 *  2. **salt por conta** — dois superadmins com o mesmo código produzem hashes
 *     diferentes, e uma tabela pré-computada não ataca vários de uma vez.
 *  3. **pepper no servidor** (variável de ambiente, fora do banco) — mesmo com
 *     o banco inteiro vazado, quem não tem o `.env` não consegue nem
 *     recalcular o hash para testar candidatos. Separa "vazamento do banco" de
 *     "vazamento do servidor".
 *  4. **comparação em tempo constante** — o tempo de resposta não denuncia
 *     quantos caracteres já batem, o que fecha ataque de temporização.
 *  5. **trava progressiva** — tentativas erradas bloqueiam a conta por
 *    some tempo, então a tentativa online também esbarra.
 *
 * O código é gerado com `randomBytes` (CSPRNG do sistema operacional), não com
 * `Math.random`, e sai uma única vez na criação: depois disso só o hash
 * existe, e nem o superadmin consegue recuperá-lo — precisa rotacionar.
 */

const SALT_BYTES = 16;
const HASH_BYTES = 64;

/** Comprimento do código, em caracteres. */
const CODE_LENGTH = 24;

/**
 * Alfabeto sem caracteres que se confundem na leitura.
 *
 * O código é digitado de vez em quando e copiado colado. Um `S` no lugar de
 * `5` joga a pessoa no acesso errado, e ela não descobre por quê — só conclui
 * que o sistema está quebrado. Por isso sai UM elemento de cada par:
 *
 *   0/O   fora os dois      1/I/L  fora o 1 e o I, fica o L
 *   2/Z   fora o 2          5/S    fora o 5
 *   6/G   fora o 6          8/B    fora o 8
 *
 * Sobram 23 letras e 4 dígitos, o que continua dando muito mais entropia do
 * que 24 caracteres sugerem. Um teste trava essa regra por par, e não por
 * lista de proibidos: proibir o `S` também jogaria fora um caractere legível,
 * e amanhã alguém acrescentaria `2` sem o teste avisar que `Z`/`2` passou a se
 * confundir.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ3479';

/** Custo do scrypt. 2^15 = 32 MiB por tentativa, ~100 ms num notebook. */
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Separa as partes de um hash scrypt, para o banco guardar em colunas. */
export interface HashedCode {
  hash: string;
  salt: string;
  /** Identificação curta para o operador, sem valor recuperável. */
  fingerprint: string;
}

/**
 * Pepper: segredo do servidor, fora do banco.
 *
 * Sem fallback silencioso. Se a variável não estiver definida, o processo
 * falha na inicialização em vez de subir com um pepper previsível — um pepper
 * padrão tipo "salao" seria pior do que não ter, porque daria a impressão de
 * proteção sem existir.
 */
function pepper(): string {
  const value = process.env.SUPERADMIN_PEPPER;
  if (!value || value.length < 16) {
    throw new Error(
      'SUPERADMIN_PEPPER ausente ou curto demais (mínimo 16 caracteres). ' +
        'Gere um com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return value;
}

/**
 * Gera um código de acesso novo, legível e sem ambiguidade.
 *
 * Rejeição em vez de `bytes[i] % 33`: 256 não é múltiplo de 33, então os
 * primeiros caracteres do alfabeto sairiam um pouco mais vezes que os últimos.
 * Com 24 caracteres isso não muda a dificuldade de adivinhar, mas é
 * exatamente o tipo de viés que vira problema quando o comprimento cresce.
 */
export function generateAccessCode(length = CODE_LENGTH): string {
  // Descarta os bytes acima do múltiplo mais próximo, deixando cada caractere
  // com a mesma chance.
  const LIMITE = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let code = '';

  while (code.length < length) {
    const bytes = randomBytes(length);
    for (let i = 0; i < bytes.length && code.length < length; i++) {
      if (bytes[i] < LIMITE) code += ALPHABET[bytes[i] % ALPHABET.length];
    }
  }

  return code;
}

/** Deriva o hash do código com o salt desta conta e o pepper do servidor. */
export async function hashCode(code: string, salt?: string): Promise<HashedCode> {
  const useSalt = salt ?? randomBytes(SALT_BYTES).toString('base64');
  const derived = await derive(
    // O pepper entra na entrada, não no salt: assim ele não precisa estar no
    // banco e continua valendo mesmo que o banco vaze.
    `${code}${pepper()}`,
    useSalt,
    HASH_BYTES,
    SCRYPT_OPTIONS
  );

  return {
    hash: derived.toString('base64'),
    salt: useSalt,
    // Impressão digital do próprio código (sem salt e sem pepper): só para o
    // operador distinguir "este é o código atual" de "este já foi rotacionado".
    fingerprint: createHash('sha256').update(`fp:${code}`).digest('hex').slice(0, 6),
  };
}

/**
 * Confere o código contra o hash guardado.
 *
 * `timingSafeEqual` exige dois buffers do mesmo tamanho; um hash truncado ou
 * corrompido no banco não pode virar exceção que distinga "hash quebrado" de
 * "código errado" — ambos são "não autenticou".
 */
export async function verifyCode(
  code: string,
  storedHash: string,
  storedSalt: string
): Promise<boolean> {
  let expected: Buffer;
  try {
    expected = Buffer.from(storedHash, 'base64');
  } catch {
    return false;
  }

  if (expected.length !== HASH_BYTES) return false;

  const derived = await derive(`${code}${pepper()}`, storedSalt, HASH_BYTES, SCRYPT_OPTIONS);

  return timingSafeEqual(derived, expected);
}

/** A impressão digital de um código, para comparar com a guardada. */
export function fingerprintOf(code: string): string {
  return createHash('sha256').update(`fp:${code}`).digest('hex').slice(0, 6);
}

/**
 * Formata o código para o operador anotar: grupos de 4, como chave de licença.
 *
 * Só serve para exibição na tela que mostra o código UMA vez. Formatar não
 * guarda: o valor em texto continua fora do banco.
 */
export function formatCodeForDisplay(code: string): string {
  return code.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Trava progressiva.
 *
 * Atraso cresce com a quantidade de falhas e satura em 30 minutos. Um atacante
 * que teste em lote por IP veria a conta fechar sozinha; e o superadmin legítimo
 * não fica preso, porque 5 erros seguidos travam por pouco tempo.
 */
export function lockDurationMs(failedAttempts: number): number {
  if (failedAttempts < 3) return 0;
  const minutes = Math.min(2 ** (failedAttempts - 3), 30);
  return minutes * 60 * 1000;
}
