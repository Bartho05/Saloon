/**
 * Scenario de desenvolvimento para inspecao de layout.
 *
 * Com valores curtos ("0", "R$ 0,00") e nomes vazios os cards do dashboard e
 * do financeiro ficam uniformes por acidente: o desalinhamento so aparece
 * quando o conteudo ocupa espaco de verdade (faturamento de cinco digitos,
 * nome longo de servico, nome de cliente comprido).
 *
 * NAO e seed de teste: e cenario manual para olhar a tela. O script recusa
 * rodar fora do schema public/dev, para nunca mexer no banco de teste.
 *
 *   node cenario-dev.js
 *   node cenario-dev.js --limpar
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TZ = -3; // America/Sao_Paulo

/** Data local do salao -> Date no instante correto. */
function localDate(ano, mes, dia, hora = 0, min = 0) {
  return new Date(Date.UTC(ano, mes - 1, dia, hora - TZ, min));
}

const CLIENTES = [
  { fullName: 'Maria Aparecida de Albuquerque Santos', phone: '31987650001', birthDate: localDate(1985, 3, 14) },
  { fullName: 'Joao Pedro', phone: '31987650002', birthDate: localDate(1992, 11, 2) },
  { fullName: 'Ana Claudia Ferreira Ribeiro Almeida', phone: '31987650003', birthDate: localDate(1978, 7, 30) },
  { fullName: 'Carlos Henrique de Souza e Oliveira', phone: '31987650004', birthDate: localDate(1996, 1, 9) },
  { fullName: 'Juliana', phone: '31987650005', birthDate: localDate(2001, 5, 22) },
  { fullName: 'Roberto Alves dos Santos Filho', phone: '31987650006', birthDate: localDate(1969, 9, 17) },
  { fullName: 'Fernanda Lima', phone: '31987650007', birthDate: localDate(1990, 12, 3) },
  { fullName: 'Beatriz', phone: '31987650008', birthDate: localDate(2003, 4, 8) },
];

async function limpar() {
  const agendamentos = await prisma.appointment.deleteMany({});
  const clientes = await prisma.client.deleteMany({
    where: { phone: { in: CLIENTES.map((c) => c.phone) } },
  });
  console.log(`agendamentos removidos: ${agendamentos.count}`);
  console.log(`clientes removidos: ${clientes.count}`);
}

async function semear() {
  const emps = await prisma.user.findMany({ where: { isActive: true } });
  const services = await prisma.service.findMany({ where: { isActive: true } });

  if (!emps.length || !services.length) {
    console.error('precisa de pelo menos um profissional e um servico ativo');
    process.exit(1);
  }

  await prisma.appointment.deleteMany({});

  const clients = [];
  for (const c of CLIENTES) {
    clients.push(
      await prisma.client.upsert({
        where: { phone: c.phone },
        update: { fullName: c.fullName, birthDate: c.birthDate },
        create: { phone: c.phone, fullName: c.fullName, birthDate: c.birthDate },
      })
    );
  }

  let criados = 0;
  let concluidos = 0;
  let cancelados = 0;
  let naoCompareceu = 0;
  let agendados = 0;
  let cursor = 0;

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;
  const diaHoje = hoje.getDate();

  /**
   * Semeia do dia 1 do mes anterior ate hoje.
   *
   * Comecar no mes anterior nao e detalhe: hoje pode ser dia 1, e sem o mes
   * anterior a visao "mes" fica com um unico dia e o grafico de barras fica
   * quase vazio — que e exatamente um dos layouts que precisam ser julgados.
   */
  const alvos = [];
  const mesAnterior = new Date(Date.UTC(ano, mes - 2, 1));
  const ultimoDiaMesAnterior = new Date(Date.UTC(ano, mes - 1, 0)).getUTCDate();
  for (let d = 1; d <= ultimoDiaMesAnterior; d++) {
    alvos.push({ ano: mesAnterior.getUTCFullYear(), mes: mesAnterior.getUTCMonth() + 1, dia: d, passado: true });
  }
  for (let d = 1; d <= diaHoje; d++) {
    alvos.push({ ano, mes, dia: d, passado: false });
  }

  const STATUS = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'SCHEDULED', 'NO_SHOW'];

  for (const alvo of alvos) {
    const semana = new Date(Date.UTC(alvo.ano, alvo.mes - 1, alvo.dia)).getUTCDay();
    if (semana === 0) continue; // domingo fechado

    // hoje rende menos: a agenda do dia corrente nao esta toda concluida ainda
    const horas = !alvo.passado && alvo.dia === diaHoje
      ? [10, 11, 14, 15, 16, 17]
      : [9, 10, 11, 12, 14, 15, 16, 17];

    for (let hi = 0; hi < horas.length; hi++) {
      for (let slot = 0; slot < 2; slot++) {
        const emp = emps[(alvo.dia + hi + slot) % emps.length];
        const svc = services[(alvo.dia * 2 + hi) % services.length];
        const cli = clients[cursor % clients.length];
        // no mes anterior tudo ja passou: concluidos, salvo o que o salao
        // perdeu (cancelado / nao compareceu)
        const status = alvo.passado
          ? ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'COMPLETED'][cursor % 8]
          : STATUS[cursor % STATUS.length];
        cursor++;

        const startsAt = localDate(alvo.ano, alvo.mes, alvo.dia, horas[hi], slot * 30);
        const endsAt = new Date(startsAt.getTime() + svc.durationMinutes * 60000);

        await prisma.appointment.create({
          data: {
            clientId: cli.id,
            employeeId: emp.id,
            serviceId: svc.id,
            startsAt,
            endsAt,
            status,
          },
        });
        criados++;
        if (status === 'COMPLETED') concluidos++;
        else if (status === 'CANCELLED') cancelados++;
        else if (status === 'NO_SHOW') naoCompareceu++;
        else agendados++;
      }
    }
  }

  console.log(`agendamentos criados: ${criados}`);
  console.log(`  concluidos: ${concluidos}`);
  console.log(`  agendados: ${agendados}`);
  console.log(`  cancelados: ${cancelados}`);
  console.log(`  nao compareceu: ${naoCompareceu}`);
  console.log(`clientes: ${clients.length}`);
  console.log(`profissionais: ${emps.length} | servicos: ${services.length}`);
}

async function main() {
  const dsn = process.env.DATABASE_URL || '';
  if (!/schema=(public|dev)/.test(dsn)) {
    console.error('recusado: so roda no schema public/dev');
    console.error('DSN:', dsn.replace(/:[^:@]*@/, ':***@'));
    process.exit(1);
  }

  if (process.argv.includes('--limpar')) await limpar();
  else await semear();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
