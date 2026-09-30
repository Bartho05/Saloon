import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@config/env';
import prisma from '@config/database';

export interface JwtPayload {
  sub: string;
  role: 'OWNER' | 'EMPLOYEE' | 'CLIENT';
  employeeId?: string;
  clientId?: string;
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
        birthDate: Date;
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
    res.status(401).json({ error: 'Token de acesso não fornecido' });
    return;
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
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

export async function clientMiddleware(
  req: AuthRequest,
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