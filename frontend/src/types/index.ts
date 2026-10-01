export interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface Employee {
  id: string;
  name: string;
  phone: string;
  specialties: string[];
  accessCode: string;
  isActive: boolean;
  photoUrl?: string | null;
  services?: Service[];
}

export interface Client {
  id: string;
  /**
   * Vazio enquanto o cadastro está incompleto: o telefone já foi
   * verificado, mas a pessoa ainda não informou o nome (primeiro
   * agendamento pendente). Não é mais preenchido com um nome falso.
   */
  fullName: string;
  phone: string;
  /** null enquanto a data de nascimento não foi informada. */
  birthDate: string | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientId: string;
  employeeId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  client?: Client;
  employee?: Employee;
  service?: Service;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: 'OWNER' | 'EMPLOYEE';
  accessCode?: string;
  isActive: boolean;
  /** Foto do rosto — o dono também é profissional e pode enviar a dele. */
  photoUrl?: string | null;
  specialties?: string[];
  createdAt?: string;
}

/** Usuário no contexto de autenticação (dono ou funcionário). */
export type AuthUser = User & Partial<Pick<Employee, 'specialties' | 'photoUrl'>>;

export interface AuthState {
  user: User | Client | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  role: 'OWNER' | 'EMPLOYEE' | 'CLIENT' | null;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface BookingFormData {
  serviceId: string;
  employeeId: string;
  startsAt: string;
  client: {
    phone: string;
    fullName?: string;
    birthDate?: string;
  };
}

export interface SalonSettings {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string | null;
  businessHours: Record<string, { open: string; close: string } | null>;
  timezone: string;
  birthdayMessage?: string;
  whatsappConfigured?: boolean;
  whatsappApiConfig?: {
    provider: 'zapi' | 'evolution' | 'meta';
    instanceId: string;
    token: string;
    apiUrl: string;
  } | null;
  cancellationHours: number;
  bufferMinutes: number;
  slotInterval: number;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number;
}