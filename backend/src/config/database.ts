import { PrismaClient } from '@prisma/client';

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
  // Pool pequeno: o PgBouncer do Supabase (transacional) reabre conexo rápido
  url.searchParams.set('connection_limit', process.env.DB_POOL_SIZE ?? '5');
  // Espera até 10s por uma conexão livre antes de falhar
  url.searchParams.set('pool_timeout', '10');
  // Sem retry infinito — fail fast e deixa a camada de erro tratar
  url.searchParams.set('connect_timeout', '10');

  return url.toString();
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
