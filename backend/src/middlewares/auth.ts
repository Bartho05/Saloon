import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import prisma from '@config/database';

export interface JwtPayload {
  sub: string;
  role: 'OWNER' | 'EMPLOYEE' | 'CLIENT' | 'SUPERADMIN';
  employeeId?: string;
  clientId?: string;
  /**
   * Só no superadmin. O JWT é assinado com o segredo do servidor, então o
   * cliente não consegue forjar; mesmo assim, cada requisição confere a conta
   * no banco, para desativar conta derrubar a sessão na hora.
   */
  superAdminId?: number;
  type: 'access' | 'refresh';
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
  userEntity?:
    | {
        id: string;
        name: string;
        phone: string;
        email: string | null;
        role: 'OWNER' | 'EMPLOYEE';
        accessCode: string | null;
        isActive: boolean;
      }
    | {
        id: string;
        fullName: string;
        phone: string;
        /** null enquanto o cadastro do cliente está incompleto */
        birthDate: Date | null;
      };
}

export function generateTokens(payload: Omit<JwtPayload, 'type'>): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ ...payload, type: 'access' }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    // O `code` distingue "token ausente" de "token inválido": sem ele o front
    // não sabe se deve tentar um refresh silencioso ou mandar o usuário ao login.
    res.status(401).json({ error: 'Token de acesso não fornecido', code: 'NOT_AUTHENTICATED' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({
      error: 'Token inválido ou expirado',
      code: 'INVALID_ACCESS_TOKEN',
    });
    return;
  }

  req.user = payload;
  next();
}

export async function ownerMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.user?.role !== 'OWNER') {
    res.status(403).json({ error: 'Acesso restrito ao proprietário' });
    return;
  }

  // Busca dados completos do dono
  const owner = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      accessCode: true,
      isActive: true,
    },
  });

  if (!owner || !owner.isActive) {
    res.status(403).json({ error: 'Proprietário não encontrado ou inativo' });
    return;
  }

  req.userEntity = owner;
  next();
}

export async function employeeMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!['OWNER', 'EMPLOYEE'].includes(req.user?.role || '')) {
    res.status(403).json({ error: 'Acesso restrito a funcionários' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, name: true, phone: true, email: true, role: true, accessCode: true, isActive: true },
  });

  if (!user || !user.isActive) {
    res.status(403).json({ error: 'Funcionário não encontrado ou inativo' });
    return;
  }

  req.userEntity = user;
  next();
}

/**
 * Exige sessão de superadmin.
 *
 * Além de confiar no JWT, confere a conta no banco a cada requisição. O token
 * do superadmin vive 15 minutos; sem essa checagem, desativar a conta não
 * tiraria ninguém de dentro imediatamente.
 *
 * Consultar o banco por requisição é o preço de poder revogar acesso na hora —
 * num nível de acesso máximo, a diferença entre "sai em 15 min" e "sai agora"
 * vale uma consulta.
 */
export async function superAdminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.user?.role !== 'SUPERADMIN') {
    res.status(403).json({ error: 'Acesso restrito ao superadmin' });
    return;
  }

  const id = req.user.superAdminId;
  if (typeof id !== 'number') {
    res.status(403).json({ error: 'Sessão de superadmin inválida' });
    return;
  }

  const admin = await prisma.superAdmin.findUnique({
    where: { id },
    select: { id: true, isActive: true },
  });

  if (!admin || !admin.isActive) {
    res.status(403).json({ error: 'Conta de superadmin inativa' });
    return;
  }

  next();
}

export async function clientMiddleware(  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (req.user?.role !== 'CLIENT') {
    res.status(403).json({ error: 'Acesso restrito a clientes' });
    return;
  }

  const client = await prisma.client.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, fullName: true, phone: true, birthDate: true },
  });

  if (!client) {
    res.status(403).json({ error: 'Cliente não encontrado' });
    return;
  }

  req.userEntity = client;
  req.user!.clientId = client.id;
  next();
}

export function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (payload) {
    req.user = payload;
  }

  next();
}