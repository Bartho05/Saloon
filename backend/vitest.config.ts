import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Os testes rodam contra o schema `test`, nunca contra o `public`.
 *
 * Carregar o `.env.test` aqui — e não dentro de setup.ts — garante que
 * process.env.DATABASE_URL já aponte para o banco de teste antes de
 * qualquer import do código da aplicação (imports são içados para o topo
 * do módulo e rodariam antes de um dotenv.config() dentro do setup).
 *
 * O setup.ts tem a trava que interrompe a suíte se isso não estiver certo.
 */
const envTest =
  dotenv.config({ path: path.resolve(__dirname, '.env.test') }).parsed ?? {};

/**
 * Falha com instrução, e não com erro de biblioteca.
 *
 * Sem `.env.test`, o primeiro erro visível é do Prima: "Invalid value undefined
 * for datasource db", em `src/config/database.ts:21`, em todas as nove suítes de
 * uma vez. Quem acabou de clonar o repositório não tem como ligar aquilo a "crie
 * o .env.test" — parece bug de configuração do projeto, e o primeiro impulso é
 * procurar no código.
 *
 * Aqui a mensagem diz o que fazer. E é uma falha de verdade, não um aviso: os
 * testes rodam `deleteMany` em dados de serviço, e sem saber qual banco é o
 * destino, rodar é mais perigoso do que não rodar.
 */
if (!envTest.DATABASE_URL) {
  throw new Error(
    [
      '',
      '════════════════════════════════════════════════════════════════',
      ' FALTANDO O ARQUIVO .env.test',
      '',
      ' Os testes precisam de um .env.test apontando para o schema `test`.',
      ' Sem ele, nenhum teste roda — de propósito: eles apagam dados de',
      ' serviço, e sem saber qual banco é o destino, rodar seria perigoso.',
      '',
      ' Para criar:',
      '',
      '   cp .env.example .env.test     # Linux/macOS',
      '   copy .env.example .env.test   # Windows',
      '',
      ' Depois ajuste DUAS linhas no arquivo criado:',
      '',
      '   DATABASE_URL  ->  schema=test    (o `public` é o banco de verdade)',
      '   NODE_ENV      ->  test',
      '',
      ' E aplique as migrations nesse schema uma vez:',
      '',
      '   npx prisma migrate deploy',
      '',
      '════════════════════════════════════════════════════════════════',
      '',
    ].join('\n')
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // As suítes de integração dividem um único schema (`test`) e criam os
    // próprios fixtures. Rodando em paralelo elas se apagam: o
    // `beforeAll` de booking.test.ts apaga o OWNER criado por auth.test.ts
    // no meio dos testes dele, e as falhas apontam para código que está
    // correto. Arquivos de teste rodam em sequência; dentro de cada um, os
    // testes continuam podendo ser paralelos.
    fileParallelism: false,
    env: {
      ...process.env,
      ...envTest,
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['src/tests/**', 'src/server.ts', 'prisma/**'],
    },
    /**
     * 30s, e não os 10s que já estavam aqui.
     *
     * O `pool_timeout` do Prisma também é 10s. Com os dois iguais, uma consulta
     * que ficou esperando conexão morria junto com o teste — e a falha apontava
     * para a função testada, que estava lenta, não errada. O sintoma era
     * `ConnectionReset (10054)` do PgBouncer do Supabase fechando conexão
     * ociosa entre arquivos, e a suíte "falhava" sozinha, sem mudança no código.
     *
     * O teste agora tem folga para o pool responder. Se algo travar de verdade,
     * 30s ainda é curto o bastante para o suite não ficar horas parado.
     */
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      // @app resolve para o arquivo solto, não para src/app/index.ts —
      // por isso não segue o padrão dos outros aliases.
      '@app': path.resolve(__dirname, './src/app.ts'),
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@controllers': path.resolve(__dirname, './src/controllers'),
      '@middlewares': path.resolve(__dirname, './src/middlewares'),
      '@models': path.resolve(__dirname, './src/models'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
});