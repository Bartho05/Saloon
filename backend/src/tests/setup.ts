import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import prisma from '@config/database';

// Setup global de testes
beforeAll(async () => {
  // Conecta ao banco de teste
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Limpa dados de teste antes de cada teste
  // Ordem importa por causa das foreign keys
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany({ where: { role: 'EMPLOYEE' } });
  // Não apaga owner para manter login funcionando entre testes
});

afterEach(async () => {
  // Cleanup adicional se necessário
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