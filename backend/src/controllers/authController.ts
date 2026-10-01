import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '@config/database';
import {
  generateTokens,
  verifyRefreshToken,
  type AuthRequest,
} from '@middlewares/auth';
import {
  ownerLoginSchema,
  employeeLoginSchema,
  clientRequestCodeSchema,
  clientVerifyCodeSchema,
  refreshTokenSchema,
} from '@utils/validation';
import { sendVerificationCode, generateVerificationCode } from '@services/whatsappService';
import { AppError } from '@middlewares/errorHandler';

// Armazenamento temporário de códigos (em produção usar Redis)
const verificationCodes = new Map<string, { code: string; expiresAt: Date }>();

/**
 * POST /auth/owner/login
 * Login do proprietário com email e senha
 */
export async function ownerLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  const owner = await prisma.user.findFirst({
    where: { email, role: 'OWNER', isActive: true },
  });

  if (!owner || !owner.passwordHash) {
    throw new AppError('Email ou senha inválidos', 401, 'INVALID_CREDENTIALS');
  }

  const validPassword = await bcrypt.compare(password, owner.passwordHash);
  if (!validPassword) {
    throw new AppError('Email ou senha inválidos', 401, 'INVALID_CREDENTIALS');
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: owner.id,
    role: 'OWNER',
  });

  res.json({
    user: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      role: owner.role,
      // o dono também atende: a sidebar e a tela de perfil usam a foto dele
      photoUrl: owner.photoUrl,
      specialties: owner.specialties,
    },
    accessToken,
    refreshToken,
  });
}

/**
 * POST /auth/employee/login
 * Login do funcionário com código de acesso
 */
export async function employeeLogin(req: Request, res: Response): Promise<void> {
  const accessCode = String(req.body.accessCode ?? '').trim();

  const employee = await prisma.user.findFirst({
    where: { accessCode, role: 'EMPLOYEE', isActive: true },
  });

  if (!employee) {
    throw new AppError('Código de acesso inválido', 401, 'INVALID_ACCESS_CODE');
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: employee.id,
    role: 'EMPLOYEE',
    employeeId: employee.id,
  });

  res.json({
    user: {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      role: employee.role,
      accessCode: employee.accessCode,
      // a sidebar mostra a foto de quem está logado
      photoUrl: employee.photoUrl,
      specialties: employee.specialties,
    },
    accessToken,
    refreshToken,
  });
}

/**
 * POST /auth/client/request-code
 * Solicita código de verificação por WhatsApp
 */
export async function clientRequestCode(req: Request, res: Response): Promise<void> {
  const { phone } = req.body;
  const isDev = process.env.NODE_ENV !== 'production';

  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  verificationCodes.set(phone, { code, expiresAt });

  // Envia por WhatsApp (imprime no terminal se não estiver configurado)
  const sent = await sendVerificationCode({ phone, code });

  if (!sent && !isDev) {
    throw new AppError(
      'Falha ao enviar código. Verifique a configuração do WhatsApp.',
      500,
      'WHATSAPP_ERROR'
    );
  }

  if (isDev) {
    // Em desenvolvimento o código volta na resposta para facilitar os testes
    res.json({ sent, code, message: 'Código enviado (modo desenvolvimento)' });
    return;
  }

  res.json({ sent: true, message: 'Código enviado via WhatsApp' });
}

/**
 * POST /auth/client/verify-code
 * Verifica código e retorna tokens
 */
export async function clientVerifyCode(req: Request, res: Response): Promise<void> {
  const { phone, code } = req.body;

  const stored = verificationCodes.get(phone);

  if (!stored) {
    throw new AppError('Código não solicitado ou expirado', 400, 'CODE_NOT_FOUND');
  }

  if (stored.expiresAt < new Date()) {
    verificationCodes.delete(phone);
    throw new AppError('Código expirado. Solicite um novo.', 400, 'CODE_EXPIRED');
  }

  if (stored.code !== code) {
    throw new AppError('Código inválido', 400, 'INVALID_CODE');
  }

  // Código válido - remove do armazenamento
  verificationCodes.delete(phone);

  // Busca ou cria cliente
  let client = await prisma.client.findUnique({
    where: { phone },
  });

  if (!client) {
    /**
     * NÃO cria o cliente aqui.
     *
     * Antes este endpoint criava um registro provisório com
     * `fullName: 'Cliente WhatsApp'` e `birthDate: 1990-01-01`, para só
     * depois o agendamento completar os dados. Duas consequências ruins:
     * o cadastro ficava com nome falso mesmo depois de a pessoa informar
     * o nome dela (o campo era tratado como preenchido, então a
     * atualização feita pelo agendamento era ignorada), e o `1990-01-01`
     * virava a data de aniversário na mensagem automática.
     *
     * A tela de agendamento já coleta nome e nascimento para cliente novo,
     * com validação no servidor. Criar aqui só produzia lixo — e foi assim
     * que o dono se cadastrou como "Cliente WhatsApp" na própria agenda.
     */
    res.json({
      client: null,
      isNew: true,
      accessToken: null,
      refreshToken: null,
    });
    return;
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: client.id,
    role: 'CLIENT',
    clientId: client.id,
  });

  res.json({
    client: {
      id: client.id,
      fullName: client.fullName,
      phone: client.phone,
      birthDate: client.birthDate,
    },
    accessToken,
    refreshToken,
  });
}

/**
 * POST /auth/refresh
 * Renova access token usando refresh token
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throw new AppError('Refresh token inválido ou expirado', 401, 'INVALID_REFRESH_TOKEN');
  }

  // Verifica se usuário/cliente ainda existe e está ativo
  if (payload.role === 'OWNER' || payload.role === 'EMPLOYEE') {
    const user = await prisma.user.findFirst({
      where: { id: payload.sub, isActive: true },
    });
    if (!user) {
      throw new AppError('Usuário não encontrado ou inativo', 401, 'USER_NOT_FOUND');
    }
  } else if (payload.role === 'CLIENT') {
    const client = await prisma.client.findUnique({
      where: { id: payload.sub },
    });
    if (!client) {
      throw new AppError('Cliente não encontrado', 401, 'CLIENT_NOT_FOUND');
    }
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens({
    sub: payload.sub,
    role: payload.role,
    employeeId: payload.employeeId,
    clientId: payload.clientId,
  });

  res.json({ accessToken, refreshToken: newRefreshToken });
}

/**
 * POST /auth/logout
 * Logout (client-side only, mas podemos invalidar refresh token se usarmos blacklist)
 */
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  // Em implementação completa, adicionar refresh token à blacklist no Redis
  res.json({ message: 'Logout realizado com sucesso' });
}

/**
 * GET /auth/me
 * Retorna dados do usuário logado
 */
export async function getMe(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw new AppError('Não autenticado', 401, 'NOT_AUTHENTICATED');
  }

  if (req.user.role === 'OWNER' || req.user.role === 'EMPLOYEE') {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      specialties: true,
    },
    });
    if (!user) throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
    res.json({ user });
  } else if (req.user.role === 'CLIENT') {
    const client = await prisma.client.findUnique({
      where: { id: req.user.sub },
      select: { id: true, fullName: true, phone: true, birthDate: true },
    });
    if (!client) throw new AppError('Cliente não encontrado', 404, 'CLIENT_NOT_FOUND');
    res.json({ client });
  }
}