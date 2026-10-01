import prisma from '@config/database';

/**
 * Trilha de auditoria de todo o sistema.
 *
 * ── Por que uma função que nunca derruba a operação ────────────────────────
 *
 * Perder um registro é ruim. Derrubar um agendamento porque a gravação do log
 * falhou é pior: o cliente tentou marcar, o horário ficou ocupado, e o
 * profissional ficou com dois na agenda. O log é infraestrutura, não regra de
 * negócio — então `record()` engole o erro de propósito e avisa no console.
 */

/**
 * Ações possíveis.
 *
 * Lista fechada e não texto livre: com texto livre, o mesmo evento acaba
 * escrito de três formas (`LOGIN`, `login`, `AUTH_LOGIN`) e nenhum filtro
 * encontra nada. O `summary` em português continua livre — a restrição é no
 * código, não na frase.
 */
export const AuditAction = {
  // acesso
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  ACCESS_CODE_REQUESTED: 'ACCESS_CODE_REQUESTED',
  ACCESS_CODE_VERIFIED: 'ACCESS_CODE_VERIFIED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // agendamento
  APPOINTMENT_CREATED: 'APPOINTMENT_CREATED',
  APPOINTMENT_UPDATED: 'APPOINTMENT_UPDATED',
  APPOINTMENT_STATUS_CHANGED: 'APPOINTMENT_STATUS_CHANGED',
  APPOINTMENT_DELETED: 'APPOINTMENT_DELETED',
  APPOINTMENT_REJECTED: 'APPOINTMENT_REJECTED',

  // cliente
  CLIENT_CREATED: 'CLIENT_CREATED',
  CLIENT_UPDATED: 'CLIENT_UPDATED',

  // serviços e profissionais
  SERVICE_CREATED: 'SERVICE_CREATED',
  SERVICE_UPDATED: 'SERVICE_UPDATED',
  SERVICE_DELETED: 'SERVICE_DELETED',
  EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
  EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
  EMPLOYEE_DELETED: 'EMPLOYEE_DELETED',
  EMPLOYEE_ACCESS_CODE_REGENERATED: 'EMPLOYEE_ACCESS_CODE_REGENERATED',
  EMPLOYEE_PHOTO_CHANGED: 'EMPLOYEE_PHOTO_CHANGED',

  // configuração
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  WHATSAPP_CONFIG_CHANGED: 'WHATSAPP_CONFIG_CHANGED',

  // WhatsApp
  WHATSAPP_SENT: 'WHATSAPP_SENT',
  WHATSAPP_FAILED: 'WHATSAPP_FAILED',
  WHATSAPP_DISCONNECTED: 'WHATSAPP_DISCONNECTED',
  WHATSAPP_MESSAGE_STATUS: 'WHATSAPP_MESSAGE_STATUS',
  WHATSAPP_INCOMING: 'WHATSAPP_INCOMING',

  // superadmin
  SUPERADMIN_BOOTSTRAP: 'SUPERADMIN_BOOTSTRAP',
  SUPERADMIN_BOOTSTRAP_DENIED: 'SUPERADMIN_BOOTSTRAP_DENIED',
  SUPERADMIN_CODE_ROTATED: 'SUPERADMIN_CODE_ROTATED',
  SUPERADMIN_UNLOCKED: 'SUPERADMIN_UNLOCKED',
  SUPERADMIN_ACTIVATED: 'SUPERADMIN_ACTIVATED',
  SUPERADMIN_DEACTIVATED: 'SUPERADMIN_DEACTIVATED',

  // instalação e rotina
  OWNER_CREATED: 'OWNER_CREATED',
  OWNER_CREATION_DENIED: 'OWNER_CREATION_DENIED',
  CRON_JOB_RUN: 'CRON_JOB_RUN',
  CRON_JOB_FAILED: 'CRON_JOB_FAILED',
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

/** Quem executou a ação. */
export type ActorKind = 'OWNER' | 'EMPLOYEE' | 'CLIENT' | 'SUPERADMIN' | 'SYSTEM' | 'ANONYMOUS';

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditEntry {
  action: AuditActionValue;
  /** Frase em português já pronta para a tela. */
  summary: string;
  entity?: string;
  entityId?: string | null;
  outcome?: AuditOutcome;
  actorKind: ActorKind;
  actorId?: string | null;
  /** Nome/e-mail no momento. Guardado em texto: a pessoa pode ser renomeada. */
  actorLabel?: string | null;
  /** Contexto extra. NUNCA colocar senha, token ou hash aqui. */
  metadata?: Record<string, unknown> | null;
}

export interface AuditRequest {
  ip?: string;
  userAgent?: string;
}

/** Extrai origem e agente de uma requisição do Express. */
export function auditContextFrom(req: {
  ip?: string;
  socket?: { remoteAddress?: string };
  get?: (name: string) => string | undefined;
}): AuditRequest {
  return {
    ip: (req.ip || req.socket?.remoteAddress || undefined)?.replace('::ffff:', ''),
    userAgent: req.get?.('user-agent') || undefined,
  };
}

/**
 * Grava uma entrada.
 *
 * ── Por que o chamador deve esperar ─────────────────────────────────────────
 *
 * A primeira versão era "fire and forget": disparava a gravação e respondia.
 * Funcionava, até dois problemas aparecerem:
 *
 * 1. **Teste instável.** A consulta de verificação rodava antes do INSERT, e o
 *    teste falhava de forma intermitente. Pior: a falha apontava para o
 *    código testado, que estava certo.
 *
 * 2. **Registro perdido em serverless.** Sem `await`, a função pode congelar
 *    assim que a resposta sai — e o log que "estava a caminho" simplesmente
 *    nunca existiu. É o pior tipo de perda: não há erro, não há sinal, só a
 *    ausência.
 *
 * O custo de esperar é um INSERT indexado, de 1 a 3 ms. Um sistema de salão
 * não tem tráfego que justifique trocar 3 ms pela chance de perder o registro.
 *
 * A ÚNICA exceção é o webhook da Z-API, onde esperar faz a API reenviar em
 * loop. Está lá comentado, com o motivo.
 *
 * O `.catch` garante que nem no `await` o chamador receba uma rejeição: o log
 * é infraestrutura, não regra de negócio, e não pode derrubar a operação.
 */
export function record(entry: AuditEntry, ctx: AuditRequest = {}): Promise<void> {
  return prisma.auditLog
    .create({
      data: {
        action: entry.action,
        summary: entry.summary,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        outcome: entry.outcome ?? 'SUCCESS',
        actorKind: entry.actorKind,
        actorId: entry.actorId ?? null,
        actorLabel: entry.actorLabel ?? null,
        metadata: (entry.metadata ?? undefined) as never,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
      },
    })
    // O `.then` sem retorno existe só para fixar o tipo em `Promise<void>`: o
    // `catch` sozinho devolveria o registro criado, e aí o chamador teria um
    // objeto à mão sem ter pedido um.
    .then(() => undefined)
    .catch((err: Error) => {
      console.error('[auditoria] falha ao gravar:', err.message);
    });
}

/**
 * Descobre quem agiu a partir do token, sem o chamador precisar montar.
 *
 * Assim o log nunca erra o `actorKind` por descuido: o papel vem do JWT, que
 * foi assinado pelo servidor, e não de um parâmetro que alguém possa passar
 * errado.
 */
export function actorFrom(req: {
  user?: { sub: string; role: string; clientId?: string; employeeId?: string; superAdminId?: number };
  body?: any;
  params?: any;
}): { actorKind: ActorKind; actorId: string | null; actorLabel: string | null } {
  const user = req.user;

  if (!user) {
    // Sem sessão: login, verificação de código e agendamento público.
    return { actorKind: 'ANONYMOUS', actorId: null, actorLabel: null };
  }

  if (user.role === 'CLIENT') {
    return {
      actorKind: 'CLIENT',
      actorId: user.clientId ?? user.sub,
      actorLabel: req.body?.client?.fullName ?? null,
    };
  }

  if (user.role === 'SUPERADMIN') {
    return {
      actorKind: 'SUPERADMIN',
      actorId: user.superAdminId != null ? String(user.superAdminId) : user.sub,
      actorLabel: req.body?.name ?? null,
    };
  }

  return {
    actorKind: user.role === 'OWNER' ? 'OWNER' : 'EMPLOYEE',
    actorId: user.sub,
    // O `name` da sessão não vem no token (o JWT é pequeno de propósito), e o
    // corpo da requisição nem sempre tem. O id basta para rastrear.
    actorLabel: req.body?.name ?? null,
  };
}

export interface AuditFilters {
  action?: string;
  entity?: string;
  entityId?: string;
  actorKind?: string;
  outcome?: AuditOutcome;
  /** Texto livre: procura em `summary` e `actorLabel`. */
  busca?: string;
  limit?: number;
  offset?: number;
}

/**
 * Consulta a trilha.
 *
 * `take` tem teto porque esta é uma tabela que só cresce: sem limite, o
 * primeiro "me mostra o log" abriria a tabela inteira em memória e derrubaria
 * o processo.
 */
export async function list(filters: AuditFilters = {}) {
  const take = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const skip = Math.max(filters.offset ?? 0, 0);

  const where: Record<string, unknown> = {};
  if (filters.action) where.action = filters.action;
  if (filters.entity) where.entity = filters.entity;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.actorKind) where.actorKind = filters.actorKind;
  if (filters.outcome) where.outcome = filters.outcome;
  if (filters.busca) {
    where.OR = [
      { summary: { contains: filters.busca, mode: 'insensitive' } },
      { actorLabel: { contains: filters.busca, mode: 'insensitive' } },
      { action: { contains: filters.busca.toUpperCase(), mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    entries: rows.map((r) => ({
      id: r.id,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      outcome: r.outcome,
      actorKind: r.actorKind,
      actorId: r.actorId,
      actorLabel: r.actorLabel,
      summary: r.summary,
      metadata: r.metadata,
      ip: r.ip,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    limit: take,
    offset: skip,
  };
}

/** Contagem por ação, para o topo da tela mostrar o que mais acontece. */
export async function summaryByAction(since?: Date) {
  const rows = await prisma.auditLog.groupBy({
    by: ['action'],
    where: since ? { createdAt: { gte: since } } : undefined,
    _count: { _all: true },
  });

  return rows
    .map((r) => ({ action: r.action, count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Apaga registros antigos.
 *
 * Existe porque o log cresce para sempre e ninguém quer fazer isso na mão.
 * A audited trail de um sistema de salão não precisa de cinco anos de
 * histórico — e o corte é explícito, com um número, e não uma remoção
 * silenciosa.
 */
export async function purgeOlderThan(olderThan: Date): Promise<number> {
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: olderThan } },
  });
  return count;
}
