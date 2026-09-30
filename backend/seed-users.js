require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);

  // ------------------------------------------------------------------
  // 1. DONO (proprietário)
  // ------------------------------------------------------------------
  const owner = await prisma.user.upsert({
    where: { email: 'eliasbartholomeu17@gmail.com' },
    update: {
      passwordHash,
      isActive: true,
      role: 'OWNER',
      // dono não usa código de acesso
      accessCode: null,
    },
    create: {
      name: 'Bartholomeo Rocha',
      email: 'eliasbartholomeu17@gmail.com',
      phone: '31971192468',
      passwordHash,
      role: 'OWNER',
      isActive: true,
      accessCode: null,
    },
  });
  console.log('✔ Dono:', owner.email);

  // ------------------------------------------------------------------
  // 2. SERVIÇOS
  // ------------------------------------------------------------------
  const catalogo = [
    { name: 'Corte Masculino', description: 'Corte de cabelo masculino', durationMinutes: 40, price: 45 },
    { name: 'Barba Completa', description: 'Aparar e hidratar a barba', durationMinutes: 30, price: 35 },
    { name: 'Corte + Barba', description: 'Combo corte masculino com barba', durationMinutes: 70, price: 70 },
    { name: 'Pigmentação', description: 'Pigmentação de falhas na barba', durationMinutes: 30, price: 40 },
    { name: 'Platinado', description: 'Descoloração global', durationMinutes: 120, price: 180 },
    { name: 'Escova Progressiva', description: 'Alisamento com escova progressiva', durationMinutes: 90, price: 150 },
  ];

  const services = [];
  for (const s of catalogo) {
    const found = await prisma.service.findFirst({ where: { name: s.name } });
    if (found) {
      services.push(found);
    } else {
      services.push(await prisma.service.create({ data: { ...s, isActive: true } }));
    }
  }
  console.log(`✔ ${services.length} serviços cadastrados`);

  // ------------------------------------------------------------------
  // 3. FUNCIONÁRIOS
  // ------------------------------------------------------------------
  const funcionarios = [
    { name: 'Carlos Souza', phone: '31988976543', accessCode: '102030', specialties: ['Corte Masculino', 'Barba Completa', 'Corte + Barba'] },
    { name: 'Ana Oliveira', phone: '31999887766', accessCode: '203040', specialties: ['Corte Masculino', 'Pigmentação', 'Platinado', 'Escova Progressiva'] },
  ];

  for (const f of funcionarios) {
    // garante que o código pertence a um funcionário (e não ao dono)
    const donoComCodigo = await prisma.user.findFirst({
      where: { accessCode: f.accessCode, role: { not: 'EMPLOYEE' } },
    });
    if (donoComCodigo) {
      await prisma.user.update({ where: { id: donoComCodigo.id }, data: { accessCode: null } });
    }

    const existing = await prisma.user.findUnique({ where: { accessCode: f.accessCode } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { name: f.name, phone: f.phone, specialties: f.specialties, isActive: true, role: 'EMPLOYEE' },
      });
    } else {
      await prisma.user.create({
        data: {
          name: f.name,
          phone: f.phone,
          accessCode: f.accessCode,
          specialties: f.specialties,
          role: 'EMPLOYEE',
          isActive: true,
        },
      });
    }
    console.log(`✔ Funcionário: ${f.name} — código ${f.accessCode}`);
  }

  // ------------------------------------------------------------------
  // 4. CONFIGURAÇÕES DO SALÃO
  // ------------------------------------------------------------------
  const businessHours = {
    0: null,
    1: { open: '09:00', close: '19:00' },
    2: { open: '09:00', close: '19:00' },
    3: { open: '09:00', close: '19:00' },
    4: { open: '09:00', close: '19:00' },
    5: { open: '09:00', close: '19:00' },
    6: { open: '09:00', close: '19:00' },
  };

  await prisma.salonSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: 'Salão Beleza',
      phone: '31971192468',
      email: 'eliasbartholomeu17@gmail.com',
      address: 'Rua das Acácias, 100 — Belo Horizonte/MG',
      businessHours,
      birthdayMessage: 'Olá {nome}! Feliz aniversário! 🎂 Venha comemorar com a gente no {salao}. Te esperamos!',
      cancellationHours: 2,
      bufferMinutes: 10,
      slotInterval: 30,
    },
  });
  console.log('✔ Configurações do salão criadas');

  // ------------------------------------------------------------------
  console.log('\n========== RESUMO ==========');
  console.log('Dono:      eliasbartholomeu17@gmail.com / 123456');
  console.log('Funcionário A: código 102030');
  console.log('Funcionário B: código 203040');
  console.log('============================\n');
}

main()
  .catch((e) => {
    console.error('ERRO:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
