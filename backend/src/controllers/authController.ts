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
import * as audit from '@services/auditService';
import { AuditAction } from '@services/auditService';
import * as codigos from '@services/verificationCodeService';

/**
 * POST /auth/owner/login
 * Login do proprietário com email e senha
 */
export async function ownerLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const ctx = audit.auditContextFrom(req);

  const owner = await prisma.user.findFirst({
    where: { email, role: 'OWNER', isActive: true },
  });

  if (!owner || !owner.passwordHash) {
    await audit.record(
      {
        action: AuditAction.LOGIN_FAILED,
        summary: 'Tentativa de entrar com senha errada',
        entity: 'auth',
        outcome: 'FAILURE',
        actorKind: 'ANONYMOUS',
        actorLabel: email,
        metadata: { papel: 'OWNER' },
      },
      ctx
    );
    throw new AppError('Email ou senha inválidos', 401, 'INVALID_CREDENTIALS');
  }

  const validPassword = await bcrypt.compare(password, owner.passwordHash);
  if (!validPassword) {
    await audit.record(
      {
        action: AuditAction.LOGIN_FAILED,
        summary: 'Tentativa de entrar com senha errada',
        entity: 'auth',
        outcome: 'FAILURE',
        // A conta existe, e isso é informação útil dentro da casa: o dono precisa
        // saber que alguém está batendo na conta DELE. Isso não vaza para fora,
        // porque a resposta ao cliente continua sendo a mesma nos dois casos.
        actorKind: 'OWNER',
        actorId: owner.id,
        actorLabel: owner.email,
        metadata: { papel: 'OWNER' },
      },
      ctx
    );
    throw new AppError('Email ou senha inválidos', 401, 'INVALID_CREDENTIALS');
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: owner.id,
    role: 'OWNER',
  });

  // Registra o acesso. O superadmin usa para ver se a conta do dono existe e
  // está sendo usada — uma conta de dono que nunca entrou é cadastro
  // incompleto, e é justamente o que trava a instalação.
  //
  // Aguarda de propósito: em "fire and forget" a gravação pode perder a corrida
  // com a resposta, e o painel mostraria "nunca entrou" logo após o primeiro
  // login. A falha é engolida porque o login já é válido neste ponto.
  try {
    await prisma.user.update({
      where: { id: owner.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // Sem efeito no login.
  }

  await audit.record(
    {
      action: AuditAction.LOGIN,
      summary: 'Entrou no painel do salão',
      entity: 'auth',
      actorKind: 'OWNER',
      actorId: owner.id,
      actorLabel: owner.name,
      metadata: { papel: 'OWNER' },
    },
    ctx
  );

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
  const ctx = audit.auditContextFrom(req);

  const employee = await prisma.user.findFirst({
    where: { accessCode, role: 'EMPLOYEE', isActive: true },
  });

  if (!employee) {
    /**
     * O código do funcionário é curto e digitado à mão. Brutar seis dígitos é
     * trivial para um script, e cada tentativa precisa ficar visível para o dono
     * — é o aviso de que alguém está tentando entrar como profissional.
     *
     * A tentativa anônima também entra, sem id de conta: o e-mail pode nem
     * existir, e a origem do acesso já vem em `ip`.
     */
    await audit.record(
      {
        action: AuditAction.LOGIN_FAILED,
        summary: 'Tentou entrar com código de acesso inexistente',
        entity: 'auth',
        outcome: 'FAILURE',
        actorKind: 'ANONYMOUS',
        metadata: { papel: 'EMPLOYEE' },
      },
      ctx
    );
    throw new AppError('Código de acesso inválido', 401, 'INVALID_ACCESS_CODE');
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: employee.id,
    role: 'EMPLOYEE',
    employeeId: employee.id,
  });

  // O acesso do profissional também é dado a conhecer: mostra que ele está
  // ativo, quando foi a última vez e de onde, que é o que responde "por que a
  // agenda dele parece abandonada".
  try {
    await prisma.user.update({
      where: { id: employee.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // Sem efeito no login.
  }

  await audit.record(
    {
      action: AuditAction.LOGIN,
      summary: 'Entrou no painel do profissional',
      entity: 'auth',
      actorKind: 'EMPLOYEE',
      actorId: employee.id,
      actorLabel: employee.name,
      metadata: { papel: 'EMPLOYEE' },
    },
    ctx
  );

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

  /**
   * Guarda ANTES de enviar.
   *
   * A ordem parece irrelevante e não é. Se o envio vier primeiro e a gravação
   * falhar, o cliente recebe um código que o sistema não tem — e ele nunca
   * consegue entrar, sem nenhuma pista do motivo. Guardando primeiro, o pior
   * caso é o cliente pedir de novo, o que a tela oferece num clique.
   */
  await codigos.guarda(phone, code);

  // Envia por WhatsApp (imprime no terminal se não estiver configurado)
  const sent = await sendVerificationCode({ phone, code });

  if (!sent && !isDev) {
    // Não configurado é o caso mais comum de falha aqui, e ele é VISÍVEL:
    // sem instância e token, nenhuma mensagem sai e o dono não sabe por quê.
    // Apagar o código evita que ele fique válido para um número que nunca o
    // recebeu.
    await codigos.descarta(phone);

    await audit.record(
      {
        action: AuditAction.WHATSAPP_FAILED,
        summary: 'Não foi possível enviar o código de verificação',
        entity: 'whatsapp',
        outcome: 'FAILURE',
        actorKind: 'CLIENT',
        actorLabel: phone,
        metadata: { telefone: phone, uso: 'codigo de acesso' },
      },
      audit.auditContextFrom(req)
    );

    throw new AppError(
      'Falha ao enviar código. Verifique a configuração do WhatsApp.',
      500,
      'WHATSAPP_ERROR'
    );
  }

  await audit.record(
    {
      action: AuditAction.ACCESS_CODE_REQUESTED,
      summary: 'Pediu código de verificação no WhatsApp',
      entity: 'auth',
      actorKind: 'CLIENT',
      actorLabel: phone,
      metadata: { telefone: phone, enviado: sent },
    },
    audit.auditContextFrom(req)
  );

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

  const resultado = await codigos.verifica(phone, code);

  /**
   * Uma resposta só, para todos os motivos.
   *
   * "Código não solicitado", "expirado" e "errado" devolvem o mesmo texto e o
   * mesmo status. Divergir confirmaria que aquele telefone tem um pedido
   * pendente — informação que ajuda quem está tentando entrar na conta alheia.
   *
   * O motivo verdadeiro vai para o log, que é interno.
   */
  if (!resultado.ok) {
    const FRASE: Record<string, string> = {
      NAO_PEDIDO: 'Código inválido. Solicite um novo.',
      EXPIRADO: 'Código inválido. Solicite um novo.',
      ERRADO: 'Código inválido. Solicite um novo.',
      ESGOTADO: 'Código inválido. Solicite um novo.',
    };

    await audit.record(
      {
        action: AuditAction.LOGIN_FAILED,
        summary: `Falhou ao confirmar o código: ${resultado.motivo}`,
        entity: 'auth',
        outcome: 'FAILURE',
        actorKind: 'CLIENT',
        actorLabel: phone,
        metadata: { telefone: phone, motivo: resultado.motivo },
      },
      audit.auditContextFrom(req)
    );

    throw new AppError(FRASE[resultado.motivo], 400, 'INVALID_CODE');
  }

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

    await audit.record(
      {
        action: AuditAction.ACCESS_CODE_VERIFIED,
        summary: 'Verificou o número. Telefone ainda sem cadastro, vai completar ao agendar',
        entity: 'auth',
        actorKind: 'CLIENT',
        actorLabel: phone,
        metadata: { telefone: phone, cadastroNovo: true },
      },
      audit.auditContextFrom(req)
    );
    return;
  }

  const { accessToken, refreshToken } = generateTokens({
    sub: client.id,
    role: 'CLIENT',
    clientId: client.id,
  });

  await audit.record(
    {
      action: AuditAction.ACCESS_CODE_VERIFIED,
      summary: 'Entrou no painel do cliente',
      entity: 'auth',
      actorKind: 'CLIENT',
      actorId: client.id,
      actorLabel: client.fullName || phone,
      metadata: { telefone: phone, cadastroNovo: false },
    },
    audit.auditContextFrom(req)
  );

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
  } else if (payload.role === 'SUPERADMIN') {
    // Confere a conta no refresh também: desativar precisa valer para o token
    // de 15 dias, não só para o de acesso.
    if (typeof payload.superAdminId !== 'number') {
      throw new AppError('Sessão de superadmin inválida', 401, 'INVALID_SESSION');
    }
    const admin = await prisma.superAdmin.findUnique({
      where: { id: payload.superAdminId },
      select: { isActive: true },
    });
    if (!admin || !admin.isActive) {
      throw new AppError('Conta de superadmin inativa', 401, 'ACCOUNT_INACTIVE');
    }
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens({
    sub: payload.sub,
    role: payload.role,
    employeeId: payload.employeeId,
    clientId: payload.clientId,
    superAdminId: payload.superAdminId,
  });

  res.json({ accessToken, refreshToken: newRefreshToken });
}

/**
 * POST /auth/logout
 * Logout (client-side only, mas podemos invalidar refresh token se usarmos blacklist)
 */
export async function logout(req: AuthRequest, res: Response): Promise<void> {
  // Em implementação completa, adicionar refresh token à blacklist no Redis
  if (req.user) {
    await audit.record(
      {
        action: AuditAction.LOGOUT,
        summary: 'Saiu do painel',
        entity: 'auth',
        actorKind:
          req.user.role === 'OWNER'
            ? 'OWNER'
            : req.user.role === 'EMPLOYEE'
              ? 'EMPLOYEE'
              : req.user.role === 'CLIENT'
                ? 'CLIENT'
                : 'SUPERADMIN',
        actorId: req.user.sub,
        metadata: { papel: req.user.role },
      },
      audit.auditContextFrom(req)
    );
  }

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

  /**
   * Superadmin vem antes de tudo: é o único papel que não vive na tabela
   * `users`, então qualquer consulta por `sub` na tabela errada devolveria
   * "não encontrado" e derrubaria a sessão do superadmin no primeiro F5.
   */
  if (req.user.role === 'SUPERADMIN') {
    const id = req.user.superAdminId;
    if (typeof id !== 'number') {
      throw new AppError('Sessão de superadmin inválida', 401, 'INVALID_SESSION');
    }
    const admin = await prisma.superAdmin.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true },
    });
    if (!admin) throw new AppError('Superadmin não encontrado', 404, 'NOT_FOUND');
    if (!admin.isActive) throw new AppError('Conta de superadmin inativa', 403, 'ACCOUNT_INACTIVE');

    // De propósito, sem `codeHash`/`codeSalt`: o hash nunca sai do servidor.
    res.json({ superAdmin: admin });
    return;
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