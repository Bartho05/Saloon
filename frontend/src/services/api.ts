import type { Service, Employee, Client, Appointment, TimeSlot, SalonSettings, SuperAdmin } from '@types';

/**
 * Prefixo da API.
 *
 * Em desenvolvimento, `/api` relativo: o proxy do Vite (ver `vite.config.ts`)
 * encaminha para o backend em `localhost:3000`. O prefixo é obrigatório, e
 * não pode ser a string vazia, porque a SPA também tem rotas `/owner/*`,
 * `/funcionario/*` e `/agendar` — sem o prefixo, o proxy não consegue separar
 * "página" de "API" e um F5 em `/owner/funcionarios` mostraria JSON.
 *
 * ── Em produção, `VITE_API_URL` é obrigatória ─────────────────────────────────
 *
 * Sem ela, a SPA chama `/api/...` no próprio domínio, o Vercel não tem função
 * nenhuma nesse prefixo, e devolve o `index.html` da SPA. O `fetch` receberia
 * HTML onde esperava JSON, e o erro seria "Unexpected token '<'" — que não
 * diz nada sobre a causa.
 *
 * Por isso a checagem abaixo existe: ela transforma um erro de parse em uma
 * frase que diz o que fazer.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Falha de configuração de deploy, dita uma vez e na primeira vez.
 *
 * Uma vez só porque o modo de erro repetido em toda tela vira ruído, e ruído é
 * o oposto de diagnóstico. Quem vê esta mensagem já sabe o que fazer.
 */
let avisouApiNaoConfigurada = false;

function erroDeConfiguracao(): Error {
  if (!avisouApiNaoConfigurada) {
    avisouApiNaoConfigurada = true;
    console.error(
      '[api] O servidor devolveu HTML onde a API devia responder.\n' +
        '      almost sempre significa que VITE_API_URL não está configurada no Vercel.\n' +
        '      Configure com a URL do backend, ex.: https://api.seudominio.com.br'
    );
  }
  return new Error(
    'Não consegui falar com o servidor. A configuração de deploy está incompleta.'
  );
}

/** Promise de refresh em andamento, para deduplicar chamadas concorrentes. */
let refreshInFlight: Promise<boolean> | null = null;

/** Limpa a sessão e avisa o AuthContext. */
export function clearSession(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.dispatchEvent(new Event('session-expired'));
}

/**
 * Renova o access token com o refresh token.
 *
 * Deduplicado por `refreshInFlight`: várias requisições que recebem 401 ao
 * mesmo tempo (uma tela carregando 4 recursos) não disparam N chamadas.
 */
function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      /**
       * Só encerra a sessão quando o refresh token é recusado de verdade.
       * Um 429 ou 500 aqui é momentâneo — matar a sessão custaria 15 dias de
       * login para o usuário resolver um limite de requisição.
       */
      if (res.status === 401 || res.status === 403) {
        clearSession();
        return false;
      }

      if (!res.ok) return false;

      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    } catch {
      // Falha de rede: não é recusa do token, então a sessão continua.
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * A falha significa "esta sessão não serve mais" — e só nesse caso a sessão
 * deve ser destruída.
 *
 * 401/403: token recusado de fato (expirado sem refresh, revogado, ou conta
 * desativada). Aí sim o logout é correto.
 *
 * Qualquer outra coisa é transitória e NÃO derruba a sessão: 429 do rate
 * limiter, 500 do servidor e erro de rede são problemas do momento, não do
 * token. Logar o usuário fora por causa disso apaga o refresh token de 15 dias
 * e obriga a redigitar a senha.
 */
export function isAuthFailure(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  /** interno: impede loop infinito de retry */
  isRetry = false
): Promise<T> {
  const token = localStorage.getItem('accessToken');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Access token expirado: renova uma vez e repete a requisição. Sem isso o
  // usuário seria deslogado a cada 15 min de inatividade, mesmo com o
  // refresh token válido.
  //
  // O guard exclui apenas /auth/refresh (senão renovar exigiria renovar).
  // /auth/me precisa entrar: é a chamada da reidratação da sessão, e é
  // justamente ela que sofre com access token vencido. `isRetry` garante
  // que só haja uma tentativa.
  const isRefreshCall = endpoint.startsWith('/auth/refresh');
  if (response.status === 401 && !isRetry && !isRefreshCall) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(endpoint, options, true);
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Erro na requisição', data);
  }

  if (response.status === 204) return undefined as T;

  /**
   * A API responde JSON. A SPA responde HTML.
   *
   * Checar o `Content-Type` antes do `parse` transforma "Unexpected token '<'"
   * — que não diz nada — na frase que diz o que fazer. É a diferença entre um
   * bug de deploy que se resolve em dois minutos e um que vira caixa-mística.
   */
  const tipo = response.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) {
    throw erroDeConfiguracao();
  }

  return response.json();
}

// Auth
export const authApi = {
  ownerLogin: (email: string, password: string) =>
    request<{ user: any; accessToken: string; refreshToken: string }>('/auth/owner/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  employeeLogin: (accessCode: string) =>
    request<{ user: any; accessToken: string; refreshToken: string }>('/auth/employee/login', {
      method: 'POST',
      body: JSON.stringify({ accessCode }),
    }),

  clientRequestCode: (phone: string) =>
    request<{ sent: boolean; code?: string }>('/auth/client/request-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  /**
 * `isNew: true` = telefone sem cadastro. O servidor não cria cliente aqui
 * de propósito; o cadastro nasce no agendamento, com o nome que a pessoa
 * digitar.
 */
clientVerifyCode: (phone: string, code: string) =>
    request<{
      client: Client | null;
      isNew?: boolean;
      accessToken: string | null;
      refreshToken: string | null;
    }>('/auth/client/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  getMe: () => request<{ user: any } | { client: Client } | { superAdmin: SuperAdmin }>('/auth/me'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Superadmin
//
// Nenhuma função daqui devolve o código de acesso: o servidor guarda só o
// hash, que não tem volta. O código aparece UMA vez, no bootstrap e na rotação.
// ─────────────────────────────────────────────────────────────────────────────
export interface SuperAdminOverview {
  counts: {
    superAdmins: number;
    owners: number;
    employees: number;
    services: number;
    clients: number;
    appointments: number;
  };
  salonName: string | null;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  steps: Array<{
    key: string;
    label: string;
    done: boolean;
    detail: string;
    route: string | null;
  }>;
  ready: boolean;
}

export type ActorKind = 'OWNER' | 'EMPLOYEE' | 'CLIENT' | 'SUPERADMIN' | 'SYSTEM' | 'ANONYMOUS';

export type AuditEntity =
  | 'appointment'
  | 'client'
  | 'service'
  | 'employee'
  | 'settings'
  | 'whatsapp'
  | 'auth'
  | 'superadmin'
  | 'cron';

export interface AuditEntry {
  id: number;
  action: string;
  entity: string | null;
  entityId: string | null;
  outcome: 'SUCCESS' | 'FAILURE';
  actorKind: string;
  actorId: string | null;
  actorLabel: string | null;
  /** Frase em português, já pronta para a tela. */
  summary: string;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditQuery {
  limit?: number;
  offset?: number;
  action?: string;
  entity?: AuditEntity;
  actorKind?: ActorKind;
  outcome?: 'SUCCESS' | 'FAILURE';
  busca?: string;
}

export const superadminApi = {
  /** Público: existe superadmin? Decide entre login e instalação. */
  getBootstrapStatus: () => request<{ hasSuperAdmin: boolean }>('/superadmin/bootstrap-status'),

  /** Cria o primeiro superadmin. Só funciona com a semente do servidor. */
  bootstrap: (data: { name: string; email: string; seed: string }) =>
    request<{ superAdmin: SuperAdmin; accessCode: string }>('/superadmin/bootstrap', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (email: string, code: string) =>
    request<{
      superAdmin: SuperAdmin;
      accessToken: string;
      refreshToken: string;
    }>('/superadmin/login', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  getOverview: () => request<{ status: SuperAdminOverview }>('/superadmin/overview'),

  getAccounts: () => request<{ superAdmins: SuperAdmin[] }>('/superadmin/accounts'),

  /**
   * Trilha de auditoria de todo o sistema, com filtros.
   *
   * Sem filtro nenhum devolve tudo, que é a pergunta que se faz de um log.
   */
  getAudit: (q: AuditQuery = {}) => {
    const params = new URLSearchParams();
    if (q.limit) params.set('limit', String(q.limit));
    if (q.offset) params.set('offset', String(q.offset));
    if (q.entity) params.set('entity', q.entity);
    if (q.actorKind) params.set('actorKind', q.actorKind);
    if (q.outcome) params.set('outcome', q.outcome);
    if (q.busca) params.set('busca', q.busca);

    const query = params.toString();
    return request<{
      entries: AuditEntry[];
      total: number;
      limit: number;
      offset: number;
      porAcao: Array<{ action: string; count: number }>;
    }>(`/superadmin/audit${query ? `?${query}` : ''}`);
  },

  getOwners: () =>
    request<{
      owners: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string;
        isActive: boolean;
        createdAt: string;
        lastLoginAt: string | null;
      }>;
    }>('/superadmin/owners'),

  createOwner: (data: { name: string; email: string; phone: string; password: string }) =>
    request<{ owner: { id: string; name: string; email: string; phone: string } }>(
      '/superadmin/owners',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  /** Devolve o código novo uma única vez. */
  rotateCode: () =>
    request<{ accessCode: string; superAdmin: SuperAdmin }>('/superadmin/rotate-code', {
      method: 'POST',
    }),

  unlock: (id: number) =>
    request<{ superAdmin: SuperAdmin }>(`/superadmin/${id}/unlock`, { method: 'POST' }),

  setActive: (id: number, isActive: boolean) =>
    request<{ superAdmin: SuperAdmin }>(`/superadmin/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
};

// Services
export const servicesApi = {
  getAll: () => request<{ services: Service[] }>('/services'),
  getById: (id: string) => request<{ service: Service }>(`/services/${id}`),
  /**
   * Serviços ativos, sem autenticação — é o que a landing page mostra.
   * Aponta para o mesmo endpoint público do agendamento, então a lista do
   * site e a do fluxo de reserva nunca divergem.
   */
  getPublic: () => request<{ services: Service[] }>('/booking/public-services'),
};

// Employees
export const employeesApi = {
  getActive: () => request<{ employees: Employee[] }>('/employees/active'),
  getByService: (serviceId: string) =>
    request<{ employees: Employee[] }>(`/employees/active?serviceId=${serviceId}`),
};

// Booking
export const bookingApi = {
  checkClient: (phone: string) =>
    request<{ exists: boolean; client?: Client }>('/booking/check-client', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  getSlots: (employeeId: string, serviceId: string, date: string) =>
    request<{ slots: TimeSlot[]; grouped: Record<number, string[]>; blocked?: boolean; reason?: string }>(
      `/booking/slots?employeeId=${employeeId}&serviceId=${serviceId}&date=${date}`
    ),

  create: (data: {
    serviceId: string;
    employeeId: string;
    startsAt: string;
    client: { phone: string; fullName?: string; birthDate?: string };
  }) =>
    request<{ appointment: Appointment; client: Client; isNewClient: boolean }>('/booking/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPublicServices: () => request<{ services: Service[] }>('/booking/public-services'),
  getPublicEmployees: (serviceId?: string) =>
    request<{ employees: Employee[] }>(
      `/booking/public-employees${serviceId ? `?serviceId=${serviceId}` : ''}`
    ),
};

// Client appointments
export const clientApi = {
  getAppointments: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    return request<{ appointments: Appointment[]; pagination: any }>(`/client/appointments?${query}`);
  },

  cancelAppointment: (id: string, reason?: string) =>
    request<{ message: string }>(`/client/appointments/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),
};

// Owner
export const ownerApi = {
  getDashboard: () => request<any>('/owner/appointments/today'),

  /**
   * Estado real da instância do WhatsApp.
   *
   * Separado de "testar envio" porque são perguntas diferentes: o teste diz se
   * uma mensagem saiu agora, o estado diz se o número está pareado. Um número
   * desconectado passa pelo teste e o cliente não recebe nada — e a diferença
   * entre "a API está errada" e "o celular desconectou" muda o conserto inteiro.
   */
  getWhatsAppStatus: () =>
    request<{
      configurado: boolean;
      conectado: boolean;
      numero: string | null;
      pushName: string | null;
      mensagem: string;
    }>('/owner/whatsapp/status'),

  /** QR Code para parear o celular, sem precisar abrir o painel da Z-API. */
  getWhatsAppQrCode: () =>
    request<{ base64: string; link: string | null }>('/owner/whatsapp/qrcode'),

  /** Cadastra os webhooks de entrega e desconexão. */
  registerWhatsAppWebhooks: () =>
    request<{ ok: boolean; detalhe: string }>('/owner/whatsapp/webhooks/register', {
      method: 'POST',
    }),

  getAppointments: (params?: { status?: string; startDate?: string; endDate?: string; employeeId?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.employeeId) query.set('employeeId', params.employeeId);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ appointments: Appointment[]; pagination: any }>(`/owner/appointments?${query}`);
  },

  // Services
  getServices: () => request<{ services: Service[] }>('/owner/services'),
  createService: (data: { name: string; description?: string; durationMinutes: number; price: number }) =>
    request<{ service: Service }>('/owner/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateService: (id: string, data: Partial<Service>) =>
    request<{ service: Service }>(`/owner/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteService: (id: string) =>
    request<{ message: string }>(`/owner/services/${id}`, { method: 'DELETE' }),

  // Employees
  getEmployees: () => request<{ employees: Employee[] }>('/owner/employees'),
  createEmployee: (data: { name: string; phone: string; specialties: string[]; serviceIds?: string[] }) =>
    request<{ employee: Employee }>('/owner/employees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEmployee: (id: string, data: Partial<Employee>) =>
    request<{ employee: Employee }>(`/owner/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  regenerateAccessCode: (id: string) =>
    request<{ employee: Employee }>(`/owner/employees/${id}/regenerate-code`, { method: 'POST' }),
  deleteEmployee: (id: string) =>
    request<{ message: string }>(`/owner/employees/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<{ settings: SalonSettings }>('/owner/settings'),
  updateSettings: (data: Partial<SalonSettings>) =>
    request<{ settings: SalonSettings }>('/owner/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  testWhatsApp: (phone: string) =>
    request<{ success: boolean; message?: string; error?: string }>('/owner/settings/test-whatsapp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  runBirthdayJob: () =>
    request<{ sent: number; failed: number }>('/owner/settings/run-birthday-job', { method: 'POST' }),
  runReminderJob: () =>
    request<{ sent: number; failed: number }>('/owner/settings/run-reminder-job', { method: 'POST' }),

  // Financeiro
  /**
   * `reference` (YYYY-MM-DD) é opcional e continua opcional: sem ele o
   * servidor assume hoje, que é o comportamento antigo.
   */
  getFinancial: (period: 'day' | 'month' | 'year', reference?: string) =>
    request<{ financial: OwnerFinancialOverview }>(
      `/owner/financial?period=${period}${reference ? `&reference=${reference}` : ''}`
    ),
};

// Employee
export const employeeApi = {
  getProfile: () => request<{ employee: Employee }>('/employee/profile'),
  getAppointments: (params?: { status?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.limit) query.set('limit', String(params.limit));
    return request<{ appointments: Appointment[]; pagination: any }>(`/employee/appointments?${query}`);
  },
  getTodayAppointments: () => request<{ appointments: Appointment[] }>('/employee/appointments/today'),
  updateAppointmentStatus: (id: string, status: Appointment['status'], notes?: string) =>
    request<{ message: string }>(`/employee/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),
  getFinancials: (period: 'day' | 'month' | 'year', reference?: string) =>
    request<{ financial: FinancialSummary }>(
      `/employee/financial?period=${period}${reference ? `&reference=${reference}` : ''}`
    ),
};
// Financeiro
export interface FinancialSummary {
  period: 'day' | 'month' | 'year';
  /** Rótulo do período, já no fuso do salão. */
  label: string;
  range: { start: string; end: string };
  totals: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenue: number;
    averageTicket: number;
    /** Já agendado e ainda não concluído — o que pode virar receita. */
    scheduled: number;
  };
  byService: Array<{ serviceId: string; name: string; count: number; revenue: number }>;
  /**
   * Série do gráfico com a granularidade do período (hora / dia / mês) e densa
   * — os periods sem atendimento vêm com `revenue: 0`, senão o gráfico mente
   * sobre o ritmo. O `label` já vem formatado no fuso do salão pelo servidor.
   */
  series: FinancialSeriesPoint[];
  /** Agendamentos um a um — é o que a visão "dia" lista. */
  appointments: FinancialAppointment[];
}

export interface FinancialSeriesPoint {
  key: string;
  /** Vazio quando o salão está fechado no dia — o gráfico não rotula esse bucket. */
  label: string;
  fullLabel: string;
  isOpen: boolean;
  count: number;
  revenue: number;
}

export interface FinancialAppointment {
  id: string;
  startsAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  /**
   * Mesmo formato do `client` das listas de agendamento, para o `clientLabel`
   * funcionar igual nos dois lugares. `fullName` pode vir vazio em cadastro
   * incompleto — daí o telefone vir junto.
   */
  client: { fullName: string; phone: string };
  employeeName: string;
  serviceName: string;
  price: number;
}

export interface OwnerFinancialOverview {
  period: 'day' | 'month' | 'year';
  label: string;
  range: { start: string; end: string };
  totals: {
    revenue: number;
    /** Atendimentos CONCLUÍDOS no período — é o que entrou no caixa. */
    appointments: number;
    /**
     * O mesmo número, nomeado como é usado na tela. Sem isto a lista
     * "N concluídos · N em aberto" precisaria inventar a conta, e ela erra:
     * `appointments` aqui só conta concluídos, não todos os agendamentos.
     */
    completed: number;
    averageTicket: number;
    scheduled: number;
  };
  employees: Array<{
    id: string;
    name: string;
    photoUrl?: string | null;
    appointments: number;
    completed: number;
    revenue: number;
    averageTicket: number;
  }>;
  byService: Array<{ name: string; count: number; revenue: number }>;
  series: FinancialSeriesPoint[];
  appointments: FinancialAppointment[];
}

export const financialApi = {
  getOwnerOverview: (period: 'day' | 'month' | 'year', reference?: string) =>
    request<{ financial: OwnerFinancialOverview }>(
      `/owner/financial?period=${period}${reference ? `&reference=${reference}` : ''}`
    ),
};

/**
 * Upload de imagem.
 *
 * Vai como FormData para não forçar o header Content-Type: com
 * `Content-Type: application/json` o browser não manda o boundary e o
 * multer não consegue ler o arquivo.
 */
async function uploadImage(endpoint: string, file: File, method = 'POST'): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const form = new FormData();
  form.append('photo', file);

  let response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });

  if (response.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) throw new ApiError(401, 'Sessão expirada');
    const newToken = localStorage.getItem('accessToken');
    response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: newToken ? { Authorization: `Bearer ${newToken}` } : undefined,
      body: form,
    });
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Falha no envio da imagem', data);
  }
}

export const uploadApi = {
  myPhoto: (file: File) => uploadImage('/employee/photo', file, 'PATCH'),
  removeMyPhoto: () =>
    request<{ employee: Employee }>('/employee/photo', { method: 'DELETE' }),
  employeePhoto: (id: string, file: File) => uploadImage(`/owner/employees/${id}/photo`, file, 'PATCH'),
  removeEmployeePhoto: (id: string) =>
    request<{ employee: Employee }>(`/owner/employees/${id}/photo`, { method: 'DELETE' }),
};

export const publicApi = {
  /**
   * Dados do salão para a landing page.
   *
   * Vem do mesmo registro que o dono edita em Configurações — a página
   * pública não guarda cópia própria, senão nome e endereço divergem.
   *
   * Rota `/salon` (o router público é montado na raiz da API, igual a
   * `/services` e `/employees/active`).
   */
  getSalon: () =>
    request<{
      salon: {
        name: string;
        phone?: string | null;
        email?: string | null;
        address?: string | null;
        description?: string | null;
        businessHours: Record<string, { open: string; close: string } | null>;
      };
    }>('/salon'),
};
