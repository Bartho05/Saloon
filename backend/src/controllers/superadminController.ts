import type { Response } from 'express';
import { AppError } from '@middlewares/errorHandler';
import { authMiddleware, generateTokens, type AuthRequest } from '@middlewares/auth';
import * as superadmin from '@services/superadminService';
import * as auditService from '@services/auditService';
import { superadminSchema } from '@utils/validation';

/**
 * Contexto de auditoria da requisição.
 *
 * A identidade do autor vem do JWT, não de um parâmetro: assim a trilha não
 * erra quem agiu por descuido, e nem um corpo de requisição forjado troca o
 * autor do registro. Nas rotas públicas o token não existe e fica `null` — que
 * é a informação correta: uma tentativa de login vem de alguém anônimo.
 */
function contextOf(req: AuthRequest): superadmin.AuditContext {
  return {
    ip: (req.ip || req.socket.remoteAddress || undefined)?.replace('::ffff:', ''),
    userAgent: req.get('user-agent') || undefined,
    actorId: req.user?.superAdminId ?? null,
  };
}

/**
 * POST /superadmin/bootstrap
 *
 * Cria o PRIMEIRO superadmin. Exige a semente do `.env` e banco sem
 * superadmin — depois de existir um, a porta se fecha sozinha.
 */
export async function bootstrap(req: AuthRequest, res: Response): Promise<void> {
  const body = superadminSchema.bootstrap.parse(req.body);
  const result = await superadmin.bootstrapSuperAdmin(body, contextOf(req));
  res.status(201).json(result);
}

/** GET /superadmin/status — público: diz se a instalação precisa de bootstrap. */
export async function bootstrapStatus(req: AuthRequest, res: Response): Promise<void> {
  const exists = await superadmin.hasAnySuperAdmin();
  res.json({ hasSuperAdmin: exists });
}

/** POST /superadmin/login — código de acesso. */
export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, code } = superadminSchema.login.parse(req.body);
  const admin = await superadmin.loginWithCode({ email, code }, contextOf(req));

  const { accessToken, refreshToken } = generateTokens({
    sub: `superadmin:${admin.superAdminId}`,
    role: 'SUPERADMIN',
    superAdminId: admin.superAdminId,
  });

  res.json({
    superAdmin: { id: admin.superAdminId, name: admin.name, email: admin.email },
    accessToken,
    refreshToken,
  });
}

/** GET /superadmin/overview */
export async function overview(req: AuthRequest, res: Response): Promise<void> {
  res.json({ status: await superadmin.systemStatus() });
}

/** GET /superadmin/accounts */
export async function listAccounts(req: AuthRequest, res: Response): Promise<void> {
  res.json({ superAdmins: await superadmin.listSuperAdmins() });
}

/**
 * GET /superadmin/audit
 *
 * Trilha do sistema inteiro, com filtros. Sem filtro nenhum devolve tudo — que
 * é a pergunta que se faz de um log ("o que aconteceu aqui?"), não "o que
 * fizeram na minha conta".
 *
 * Os valores de `actorKind` e `entity` são validados contra a lista fechada em
 * `auditService`: um filtro arbitrário viraria um ponto cego, e a pessoa
 * buscaria por algo que nunca volta sem perceber.
 */
export async function listAuditLog(req: AuthRequest, res: Response): Promise<void> {
  const actorKind = req.query.actorKind
    ? superadminSchema.actorKind.parse(req.query.actorKind)
    : undefined;
  const entity = req.query.entity
    ? superadminSchema.auditEntity.parse(req.query.entity)
    : undefined;

  const trilha = await auditService.list({
    limit: Number(req.query.limit) || 100,
    offset: Number(req.query.offset) || 0,
    action: req.query.action ? String(req.query.action) : undefined,
    entity,
    entityId: req.query.entityId ? String(req.query.entityId) : undefined,
    actorKind,
    outcome: req.query.outcome ? superadminSchema.outcome.parse(req.query.outcome) : undefined,
    busca: req.query.busca ? String(req.query.busca) : undefined,
  });

  res.json({ ...trilha, porAcao: await auditService.summaryByAction() });
}

/** POST /superadmin/rotate-code */
export async function rotateCode(req: AuthRequest, res: Response): Promise<void> {
  const id = req.user!.superAdminId;
  if (typeof id !== 'number') throw new AppError('Sessão inválida', 401, 'UNAUTHORIZED');
  res.json(await superadmin.rotateCode(id, contextOf(req)));
}

/** POST /superadmin/:id/unlock */
export async function unlock(req: AuthRequest, res: Response): Promise<void> {
  const id = superadminSchema.id.parse(req.params.id);
  res.json({ superAdmin: await superadmin.unlock(id, contextOf(req)) });
}

/** PATCH /superadmin/:id/active */
export async function setActive(req: AuthRequest, res: Response): Promise<void> {
  const id = superadminSchema.id.parse(req.params.id);
  const { isActive } = superadminSchema.setActive.parse(req.body);
  res.json({ superAdmin: await superadmin.setActive(id, isActive, contextOf(req)) });
}

/** GET /superadmin/owners */
export async function listOwners(req: AuthRequest, res: Response): Promise<void> {
  res.json({ owners: await superadmin.listOwners() });
}

/**
 * POST /superadmin/owners
 *
 * Cria o primeiro proprietário. É o passo que destrava a instalação: sem dono
 * não existe quem abra o painel nem cadastre serviço.
 */
export async function createOwner(req: AuthRequest, res: Response): Promise<void> {
  const body = superadminSchema.createOwner.parse(req.body);
  const owner = await superadmin.createFirstOwner(body, contextOf(req));
  res.status(201).json({ owner });
}

export { authMiddleware };
