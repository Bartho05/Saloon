import { beforeAll, afterAll } from 'vitest';
import prisma from '@config/database';

/**
 * TRAVA ANTI-DESTRUÇÃO
 *
 * Este arquivo roda `deleteMany` em serviços, clientes, agendamentos e
 * funcionários antes de cada teste. Se o `beforeEach` apontar para o
 * `DATABASE_URL` do `.env` normal, ele apaga os dados do salão de verdade
 * — foi exatamente o que aconteceu: rodar `npm test` zerou serviços e
 * agendamentos do banco de desenvolvimento.
 *
 * Por isso `vitest.config.ts` carrega o `.env.test` (schema `test`) antes de
 * qualquer import. Esta trava existe para falhar alto e legível se ele
 * faltar, em vez de apagar o banco em silêncio.
 */
const dbUrl = process.env.DATABASE_URL ?? '';
const isTestDatabase =
  /[?&]schema=test\b/.test(dbUrl) || /\/(test[^/?]*)(?:\?|$)/.test(dbUrl);

if (!isTestDatabase) {
  throw new Error(
    [
      '',
      '════════════════════════════════════════════════════════════════',
      ' RECUSADO: os testes tentariam apagar o banco de DESENVOLVIMENTO.',
      '',
      ` DATABASE_URL aponta para: ${dbUrl.replace(/:\/\/[^@]*@/, '://***@') || '(vazio)'}`,
      '',
      ' Este setup executa deleteMany() em serviços, clientes,',
      ' agendamentos e funcionários antes de cada teste.',
      '',
      ' Crie o .env.test (uma cópia do .env com schema=test):',
      '',
      '   copy .env .env.test   # Linux/macOS: cp .env .env.test',
      '   # depois troque schema=public por schema=test',
      '',
      ' Aplique as migrations nesse schema uma vez:',
      '',
      '   npx prisma migrate deploy   # com o .env.test carregado',
      '════════════════════════════════════════════════════════════════',
      '',
    ].join('\n')
  );
}

// Setup global de testes
beforeAll(async () => {
  await prisma.$connect();

  // A limpeza acontece AQUI, uma vez por arquivo de teste — e não em
  // `beforeEach`.
  //
  // As suítes de integração criam os próprios fixtures no `beforeAll` e
  // precisam que eles sobrevivam aos testes seguintes. Com o `deleteMany`
  // em `beforeEach`, o funcionário e o serviço criados no `beforeAll` sumiam
  // antes do primeiro `it`, e a falha apontava para o código testado.
  // Ordem importa por causa das foreign keys.
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany({ where: { role: 'EMPLOYEE' } });
  // Não apaga owner: o login de outras suítes depende dele
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Mock de console.error para não poluir output dos testes
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Filtra erros esperados em testes
    const msg = args[0]?.message || args[0] || '';
    if (
      msg.includes('Código') ||
      msg.includes('Token') ||
      msg.includes('Horário') ||
      msg.includes('não encontrado') ||
      msg.includes('inválido')
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});