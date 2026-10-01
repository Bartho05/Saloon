/**
 * Cria o superadmin de desenvolvimento e imprime o código uma única vez.
 *
 * O código não é recuperável depois — o servidor guarda só o hash. Por isso
 * este script existe: é a forma de emitir o primeiro código e anotá-lo.
 *
 *   node criar-superadmin-dev.js
 */

require('dotenv').config();
const API = 'http://localhost:3000';

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const existentes = await prisma.superAdmin.findMany({ select: { email: true, isActive: true } });
  if (existentes.length > 0) {
    console.log('Já existe superadmin:');
    for (const a of existentes) console.log(`  ${a.email} (${a.isActive ? 'ativo' : 'inativo'})`);
    console.log('');
    console.log('Para gerar um novo código de um existente, use a tela');
    console.log('/superadmin/contas — botão "Gerar novo código".');
    await prisma.$disconnect();
    return;
  }

  await prisma.auditLog.deleteMany({});
  await prisma.$disconnect();

  const seed = process.env.SUPERADMIN_BOOTSTRAP_SEED;
  if (!seed) {
    console.error('SUPERADMIN_BOOTSTRAP_SEED não está no .env.');
    process.exit(1);
  }

  const res = await fetch(`${API}/superadmin/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Administrador',
      email: 'admin@bernardobarber.com',
      seed,
    }),
  });

  const body = await res.json();

  if (res.status !== 201) {
    console.error('Falhou:', res.status, JSON.stringify(body));
    process.exit(1);
  }

  console.log('Superadmin criado.');
  console.log('');
  console.log('  e-mail: admin@bernardobarber.com');
  console.log('  código: ' + body.accessCode.replace(/(.{4})/g, '$1 ').trim());
  console.log('');
  console.log('Entre em /superadmin/login. Este código não tem volta:');
  console.log('se perder, gere outro pela tela de contas de acesso.');
}

main().catch((e) => { console.error(e); process.exit(1); });
