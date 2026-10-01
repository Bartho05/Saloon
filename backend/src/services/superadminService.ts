import prisma from '@config/database';
import { AppError } from '@middlewares/errorHandler';
import {
  generateAccessCode,
  hashCode,
  verifyCode,
  fingerprintOf,
  lockDurationMs,
} from '@services/superadminCrypto';
import { env } from '@config/env';

export interface AuditContext {
  ip?: string;
  userAgent?: string;
}

export interface SuperAdminPublic {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  codeFingerprint: string;
  codeCreatedAt: string;
  codeRotatedAt: string | null;
  createdAt: string;
}

/**
 * Registro de auditoria.
 *
 * Falha de escrita aqui NÃO pode derrubar a operação: perder um log é ruim,
 * mas derrubar o login do superadmin por causa do log seria pior. A exceção é
 * engolida de propósito e o problema fica no console.
 */
async function audit(
  action: string,
  ctx: AuditContext,
  detail?: string,
  superAdminId?: number
): Promise<void> {
  try {
    await prisma.superAdminAudit.create({
      data: {
        action,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        detail: detail ?? null,
        superAdminId: superAdminId ?? null,
      },
    });
  } catch (err) {
    console.error('[superadmin] falha ao gravar auditoria:', (err as Error).message);
  }
}

function toPublic(a: {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  codeFingerprint: string;
  codeCreatedAt: Date;
  codeRotatedAt: Date | null;
  createdAt: Date;
}): SuperAdminPublic {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    codeFingerprint: a.codeFingerprint,
    codeCreatedAt: a.codeCreatedAt.toISOString(),
    codeRotatedAt: a.codeRotatedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

/** Existe algum superadmin? Define se a rota de login pode existir. */
export async function hasAnySuperAdmin(): Promise<boolean> {
  return (await prisma.superAdmin.count()) > 0;
}

/**
 * Cria o primeiro superadmin.
 *
 * Só funciona com banco vazio de superadmins E com a semente correta do `.env`.
 * Três camadas: a semente é do arquivo de ambiente, o método é POST, e o banco
 * precisa estar vazio. Um atacante que chegue pela rede sem o `.env` não tem a
 * primeira; um script automatizado que sondasse o valor precisaria adivinhar 16+
 * caracteres.
 */
export async function bootstrapSuperAdmin(
  input: { name: string; email: string; seed: string },
  ctx: AuditContext
): Promise<{ superAdmin: SuperAdminPublic; accessCode: string }> {
  const seed = env.SUPERADMIN_BOOTSTRAP_SEED;

  if (!seed) {
    throw new AppError(
      'Bootstrap desativado. Defina SUPERADMIN_BOOTSTRAP_SEED no servidor para habilitar.',
      503,
      'BOOTSTRAP_DISABLED'
    );
  }

  if (input.seed !== seed) {
    // Auditoria SEM o superAdminId: é justamente a tentativa que precisa ficar
    // registrada mesmo sem conta correspondente.
    await audit('BOOTSTRAP_DENIED', ctx, `e-mail informado: ${input.email}`);    throw new AppError('Semente inválida', 401, 'INVALID_SEED');
  }

  if (await hasAnySuperAdmin()) {
    throw new AppError(
      'Já existe um superadmin. Use o login por código.',
      409,
      'ALREADY_BOOTSTRAPPED'
    );
  }

  const email = input.email.trim().toLowerCase();
  const code = generateAccessCode();
  const { hash, salt, fingerprint } = await hashCode(code);

  const created = await prisma.superAdmin.create({
    data: {
      name: input.name.trim(),
      email,
      codeHash: hash,
      codeSalt: salt,
      codeFingerprint: fingerprint,
    },
  });

  await audit('BOOTSTRAP', ctx, `superadmin criado: ${email}`, created.id);

  // O código volta em texto uma única vez, aqui. Nem o banco nem nenhum log
  // o guardam: se o operador perder, a saída é rotacionar.
  return { superAdmin: toPublic(created), accessCode: code };
}

/**
 * Autentica por código.
 *
 * Mesma resposta para "não existe", "código errado" e "conta travada": um
 * atacante não consegue distinguir e assim não sabe se o e-mail existe. O
 * código também é normalizado (maiúsculas e sem espaços) porque ele é exibido
 * em grupos de 4 e copiado com espaço junto.
 */
export async function loginWithCode(
  input: { email: string; code: string },
  ctx: AuditContext
): Promise<{ superAdminId: number; email: string; name: string }> {
  const email = input.email.trim().toLowerCase();
  const code = normalizeCode(input.code);

  const admin = await prisma.superAdmin.findUnique({ where: { email } });

  // Conta inexistente: gasta o mesmo tempo de um scrypt real, senão a resposta
  // rápida revelaria que o e-mail não existe.
  if (!admin) {
    await hashCode(code);
    await audit('LOGIN_FAILED', ctx, `e-mail inexistente: ${email}`);
    throw new AppError('E-mail ou código inválido', 401, 'INVALID_CREDENTIALS');
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const minutos = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    await audit('LOCKED', ctx, `${email} — travado por mais ${minutos} min`, admin.id);
    throw new AppError(
      `Conta travada por excesso de tentativas. Tente em ${minutos} minuto(s).`,
      429,
      'ACCOUNT_LOCKED'
    );
  }

  if (!admin.isActive) {
    await audit('LOGIN_FAILED', ctx, `${email} — conta desativada`, admin.id);
    throw new AppError('E-mail ou código inválido', 401, 'INVALID_CREDENTIALS');
  }

  const ok = await verifyCode(code, admin.codeHash, admin.codeSalt);

  if (!ok) {
    const falhas = admin.failedAttempts + 1;
    const lockMs = lockDurationMs(falhas);
    const lockedUntil = lockMs > 0 ? new Date(Date.now() + lockMs) : null;

    await prisma.superAdmin.update({
      where: { id: admin.id },
      data: {
        failedAttempts: falhas,
        lockedUntil,
      },
    });

    await audit(
      'LOGIN_FAILED',
      ctx,
      `${email} — ${falhas}ª falha${lockedUntil ? `, travado até ${lockedUntil.toISOString()}` : ''}`,
      admin.id
    );

    // Mensagem genérica de propósito: confirmar "código errado" já é o bastante
    // para o atacante refinar, sem confirmar se a conta existe.
    throw new AppError('E-mail ou código inválido', 401, 'INVALID_CREDENTIALS');
  }

  await prisma.superAdmin.update({
    where: { id: admin.id },
    data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  await audit('LOGIN_SUCCESS', ctx, email, admin.id);

  return { superAdminId: admin.id, email: admin.email, name: admin.name };
}

/** Troca o código. O antigo morre na hora e não é recuperável. */
export async function rotateCode(
  superAdminId: number,
  ctx: AuditContext
): Promise<{ accessCode: string; superAdmin: SuperAdminPublic }> {
  const admin = await prisma.superAdmin.findUnique({ where: { id: superAdminId } });
  if (!admin) throw new AppError('Superadmin não encontrado', 404, 'NOT_FOUND');

  const code = generateAccessCode();
  const { hash, salt, fingerprint } = await hashCode(code);

  const updated = await prisma.superAdmin.update({
    where: { id: superAdminId },
    data: {
      codeHash: hash,
      codeSalt: salt,
      codeFingerprint: fingerprint,
      codeRotatedAt: new Date(),
      // Rotacionar também destrava: quem estava travado por erro de digitação
      // volta a conseguir entrar.
      failedAttempts: 0,
      lockedUntil: null,
    },
  });

  await audit('ROTATE_CODE', ctx, `código anterior ${admin.codeFingerprint} → ${fingerprint}`, superAdminId);

  return { accessCode: code, superAdmin: toPublic(updated) };
}

/** Lista os superadmins, sem nenhum campo de segredo. */
export async function listSuperAdmins(): Promise<SuperAdminPublic[]> {
  const rows = await prisma.superAdmin.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toPublic);
}

export async function getSuperAdmin(id: number): Promise<SuperAdminPublic | null> {
  const admin = await prisma.superAdmin.findUnique({ where: { id } });
  return admin ? toPublic(admin) : null;
}

export async function setActive(
  id: number,
  isActive: boolean,
  ctx: AuditContext
): Promise<SuperAdminPublic> {
  const updated = await prisma.superAdmin.update({ where: { id }, data: { isActive } });
  await audit(isActive ? 'ACTIVATE' : 'DEACTIVATE', ctx, updated.email, id);
  return toPublic(updated);
}

/** Destrava uma conta manualmente (o superadmin está trancado fora da própria tela). */
export async function unlock(id: number, ctx: AuditContext): Promise<SuperAdminPublic> {
  const updated = await prisma.superAdmin.update({
    where: { id },
    data: { failedAttempts: 0, lockedUntil: null },
  });
  await audit('UNLOCK', ctx, updated.email, id);
  return toPublic(updated);
}

/** Trilha de auditoria, mais recente primeiro. */
export async function listAudit(limit = 100) {
  const rows = await prisma.superAdminAudit.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 500),
    include: { superAdmin: { select: { name: true, email: true } } },
  });

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    ip: r.ip,
    userAgent: r.userAgent,
    detail: r.detail,
    createdAt: r.createdAt.toISOString(),
    superAdmin: r.superAdmin ? { name: r.superAdmin.name, email: r.superAdmin.email } : null,
  }));
}

/**
 * Estado do sistema para a tela inicial do superadmin.
 *
 * Existe para responder "o que ainda falta para isso funcionar?" — que é
 * justamente a pergunta de quem acabou de instalar.
 */
export async function systemStatus() {
  const [
    superAdmins,
    owners,
    employees,
    services,
    clients,
    appointments,
    salon,
    lastLogin,
    recentFailures,
  ] = await Promise.all([
    prisma.superAdmin.count(),
    prisma.user.count({ where: { role: 'OWNER' } }),
    prisma.user.count({ where: { role: 'EMPLOYEE' } }),
    prisma.service.count(),
    prisma.client.count(),
    prisma.appointment.count(),
    prisma.salonSettings.findUnique({ where: { id: 1 }, select: { name: true } }),
    prisma.superAdmin.findFirst({ orderBy: { lastLoginAt: 'desc' }, select: { lastLoginAt: true } }),
    prisma.superAdminAudit.count({ where: { action: 'LOGIN_FAILED' } }),
  ]);

  /**
   * Lista de verificação de instalação.
   *
   * Sem proprietário o sistema não tem quem cadastre serviço nem quem abra o
   * painel: é o bloqueio número um de quem instala do zero, e o superadmin é a
   * única pessoa na posição de destravá-lo.
   */
  const steps = [
    {
      key: 'superadmin',
      label: 'Superadmin criado',
      done: superAdmins > 0,
      detail: 'Acesso de nível máximo à instalação',
      route: null,
    },
    {
      key: 'owner',
      label: 'Proprietário do salão',
      done: owners > 0,
      detail: owners > 0 ? `${owners} cadastrado(s)` : 'Obrigatório: sem dono o sistema não abre',
      route: '/superadmin/proprietarios',
    },
    {
      key: 'services',
      label: 'Serviços cadastrados',
      done: services > 0,
      detail: services > 0 ? `${services} ativo(s)` : 'O dono precisa cadastrar o que vende',
      route: '/superadmin/proprietarios',
    },
    {
      key: 'employees',
      label: 'Profissionais cadastrados',
      done: employees > 0,
      detail: employees > 0 ? `${employees} ativo(s)` : 'Opcional: o dono pode atender sozinho',
      route: null,
    },
    {
      key: 'appointments',
      label: 'Agendamentos criados',
      done: appointments > 0,
      detail: appointments > 0 ? `${appointments} no total` : 'Começa a existir quando o primeiro cliente agendar',
      route: null,
    },
  ];

  return {
    counts: { superAdmins, owners, employees, services, clients, appointments },
    salonName: salon?.name ?? null,
    lastLoginAt: lastLogin?.lastLoginAt?.toISOString() ?? null,
    failedLoginAttempts: recentFailures,
    steps,
    ready: steps.every((s) => s.done),
  };
}

/** Retira espaços e hifens, e passa a maiúsculas: o código é colado em grupos. */
function normalizeCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Cria o primeiro proprietário.
 *
 * Esta é a função que destrava a instalação. Sem dono não existe quem cadastre
 * serviço, quem abra o painel nem quem receba agendamento — o sistema fica
 * parado. E só o superadmin pode executá-la, porque é o único acima do dono na
 * hierarquia.
 *
 * A senha vai para o banco como hash bcrypt, nunca em texto, e o e-mail do dono
 * entra na lista de quem pode redefinir a senha: o superadmin é a rede de
 * segurança se o dono perder o acesso.
 */
export async function createFirstOwner(
  input: { name: string; email: string; phone: string; password: string },
  ctx: AuditContext
): Promise<{ id: string; name: string; email: string; phone: string }> {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone;

  const existente = await prisma.user.findFirst({
    where: { OR: [{ email }, { phone }] },
    select: { id: true, name: true, role: true },
  });

  if (existente) {
    await audit('CREATE_OWNER_DENIED', ctx, `conflito com ${existente.role} ${existente.name}`);
    throw new AppError(
      'Já existe um usuário com este e-mail ou telefone.',
      409,
      'DUPLICATE_USER'
    );
  }

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.default.hash(input.password, 12);

  const owner = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone,
      passwordHash,
      role: 'OWNER',
      isActive: true,
    },
    select: { id: true, name: true, email: true, phone: true },
  });

  await audit('CREATE_OWNER', ctx, `proprietário criado: ${owner.name} <${owner.email}>`);

  // `email` é gravado a partir de uma string já validada, então nunca é null
  // aqui — o tipo do banco é opcional porque o funcionário pode não ter e-mail.
  return { ...owner, email: owner.email as string };
}

/** Lista os proprietários, para o superadmin ver e conferir. */
export async function listOwners() {
  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  return owners.map((o) => ({
    id: o.id,
    name: o.name,
    email: o.email,
    phone: o.phone,
    isActive: o.isActive,
    createdAt: o.createdAt.toISOString(),
    lastLoginAt: o.lastLoginAt ?? null,
  }));
}
