import type { Service, Employee, Client, Appointment, TimeSlot, SalonSettings } from '@types';

/**
 * Prefixo da API.
 *
 * Precisa ser /api (e não '') porque a SPA também tem rotas /owner/*,
 * /funcionario/*, /agendar. Sem o prefixo, o proxy do Vite não consegue
 * separar "página" de "API" e um F5 quebra o app.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

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

      if (!res.ok) {
        clearSession();
        return false;
      }

      const data = await res.json();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

  clientVerifyCode: (phone: string, code: string) =>
    request<{ client: Client; accessToken: string; refreshToken: string }>('/auth/client/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  getMe: () => request<{ user: any } | { client: Client }>('/auth/me'),
};

// Services
export const servicesApi = {
  getAll: () => request<{ services: Service[] }>('/services'),
  getById: (id: string) => request<{ service: Service }>(`/services/${id}`),
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
  getFinancial: (period: 'day' | 'month' | 'year') =>
    request<{ financial: OwnerFinancialOverview }>(`/owner/financial?period=${period}`),
};

// Employee
export const employeeApi = {
  getProfile: () => request<{ employee: Employee }>('/employee/profile'),
  getAppointments: (params?: { status?: string; startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return request<{ appointments: Appointment[]; pagination: any }>(`/employee/appointments?${query}`);
  },
  getTodayAppointments: () => request<{ appointments: Appointment[] }>('/employee/appointments/today'),
  updateAppointmentStatus: (id: string, status: Appointment['status'], notes?: string) =>
    request<{ message: string }>(`/employee/appointments/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }),
  getFinancials: (period: 'day' | 'month' | 'year') =>
    request<{ financial: FinancialSummary }>(`/employee/financial?period=${period}`),
};
// Financeiro
export interface FinancialSummary {
  period: 'day' | 'month' | 'year';
  range: { start: string; end: string };
  totals: {
    appointments: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenue: number;
    averageTicket: number;
  };
  byService: Array<{ serviceId: string; name: string; count: number; revenue: number }>;
  daily: Array<{ date: string; count: number; revenue: number }>;
}

export interface OwnerFinancialOverview {
  period: 'day' | 'month' | 'year';
  label: string;
  totals: { revenue: number; appointments: number; averageTicket: number };
  employees: Array<{
    id: string;
    name: string;
    appointments: number;
    completed: number;
    revenue: number;
    averageTicket: number;
  }>;
  byService: Array<{ name: string; count: number; revenue: number }>;
  daily: Array<{ date: string; count: number; revenue: number }>;
}

export const financialApi = {
  getOwnerOverview: (period: 'day' | 'month' | 'year') =>
    request<{ financial: OwnerFinancialOverview }>(`/owner/financial?period=${period}`),
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
  salonLogo: (file: File) => uploadImage('/owner/settings/logo', file),
  removeSalonLogo: () =>
    request<{ settings: SalonSettings }>('/owner/settings/logo', { method: 'DELETE' }),
  employeeSalonLogo: (file: File) => uploadImage('/employee/salon/logo', file),
  myPhoto: (file: File) => uploadImage('/employee/photo', file, 'PATCH'),
  removeMyPhoto: () =>
    request<{ employee: Employee }>('/employee/photo', { method: 'DELETE' }),
  employeePhoto: (id: string, file: File) => uploadImage(`/owner/employees/${id}/photo`, file, 'PATCH'),
  removeEmployeePhoto: (id: string) =>
    request<{ employee: Employee }>(`/owner/employees/${id}/photo`, { method: 'DELETE' }),
};

export const salonApi = {
  get: () => request<{ settings: SalonSettings }>('/employee/salon'),
  update: (data: Partial<SalonSettings>) =>
    request<{ settings: SalonSettings }>('/employee/salon', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

export { ApiError };
