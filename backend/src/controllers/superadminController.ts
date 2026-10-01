import type { Response } from 'express';
import { AppError } from '@middlewares/errorHandler';
import { authMiddleware, generateTokens, type AuthRequest } from '@middlewares/auth';
import * as superadmin from '@services/superadminService';
import { superadminSchema } from '@utils/validation';

function contextOf(req: AuthRequest) {
  return {
    ip: (req.ip || req.socket.remoteAddress || undefined)?.replace('::ffff:', ''),
    userAgent: req.get('user-agent') || undefined,
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

/** GET /superadmin/audit */
export async function listAuditLog(req: AuthRequest, res: Response): Promise<void> {
  const limit = Number(req.query.limit) || 100;
  res.json({ entries: await superadmin.listAudit(limit) });
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
