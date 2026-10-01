import { PrismaClient } from '@prisma/client';
import { emServerless } from './ambiente';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Pool de conexões.
 *
 * O Supabase usa o PgBouncer em modo transacional, que fecha conexões
 * ociosas. Sem `connection_limit` baixo + `pool_timeout`, o Prisma segura
 * conexões mortas e a próxima consulta morre com `ConnectionReset (10054)`
 * — erro intermitente, difícil de reproduzir e que appearcia como 500.
 *
 * `pgbouncer=true` desliga o prepared statements, exigido pelo modo
 * transacional do PgBouncer.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        // Mantém a string de conexão original e acrescenta os parâmetros
        url: buildConnectionUrl(),
      },
    },
  });

function buildConnectionUrl(): string | undefined {
  const base = process.env.DATABASE_URL;
  if (!base) return undefined;

  const url = new URL(base);

  // PgBouncer em modo transacional não suporta prepared statements
  url.searchParams.set('pgbouncer', 'true');
  /**
   * Tamanho do pool, e por que e 1 no serverless.
   *
   * Em um servidor normal, pool de 5 e bom: uma instancia, cinco conexoes, e o
   * banco folgado. Em serverless a conta e outra: cada instancia viva tem o SEU
   * pool. Dez instancias ativas com pool 5 sao 50 conexoes, e o Supabase derruba
   * tudo com "too many connections" assim que o numero estoura - normalmente no
   * horario de pico, quando mais gente esta agendando.
   *
   * Com `connection_limit=1` sao 10 conexoes no mesmo cenario, e uma instancia
   * serverless quase nunca precisa de duas ao mesmo tempo: ela atende uma
   * requisicao por vez. O custo e serializar requisicoes dentro de uma instancia
   * - invisivel para um sistema de salao, e microsegundos de espera por consulta.
   *
   * O default muda sozinho, sem depender de o operador lembrar. Quem quiser
   * sobrescrever (Railway, Render, VPS) define `DB_POOL_SIZE`.
   */
  const padrao = emServerless ? '1' : '5';
  url.searchParams.set('connection_limit', process.env.DB_POOL_SIZE ?? padrao);
  // Espera até 10s por uma conexão livre antes de falhar
  url.searchParams.set('pool_timeout', '10');
  // Sem retry infinito — fail fast e deixa a camada de erro tratar
  url.searchParams.set('connect_timeout', '10');

  return url.toString();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
