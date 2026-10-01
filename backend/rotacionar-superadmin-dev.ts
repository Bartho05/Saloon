/**
 * Gera um novo código de acesso do superadmin e imprime uma única vez.
 *
 * Existe para desenvolvimento, quando o código se perde — que é justamente o
 * que o código é feito para exigir. Em produção, quem está fora da conta usa a
 * tela de contas de acesso... que exige estar dentro. Por isso este script é
 * deliberadamente manual: rodar um comando no servidor tem de ser mais difícil
 * que usar o sistema.
 *
 *   npx tsx rotacionar-superadmin-dev.ts <email>
 */
import prisma from '@config/database';
import { generateAccessCode, hashCode } from '@services/superadminCrypto';

async function main() {
  const email = (process.argv[2] ?? 'admin@bernardobarber.com').trim().toLowerCase();

  const admin = await prisma.superAdmin.findUnique({ where: { email } });
  if (!admin) {
    console.error(`Nenhum superadmin com o e-mail ${email}.`);
    process.exit(1);
  }

  const code = generateAccessCode();
  const { hash, salt, fingerprint } = await hashCode(code);

  await prisma.superAdmin.update({
    where: { id: admin.id },
    data: {
      codeHash: hash,
      codeSalt: salt,
      codeFingerprint: fingerprint,
      codeRotatedAt: new Date(),
      // Rotacionar também destrava: quem errou o código cinco vezes pode
      // entrar de novo sem esperar a trava passar.
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log(`Novo código para ${admin.email}:`);
  console.log('');
  console.log('  ' + code.replace(/(.{4})/g, '$1 ').trim());
  console.log('');
  console.log(`Impressão: ${fingerprint}. Anote agora: não tem como recuperar depois.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
