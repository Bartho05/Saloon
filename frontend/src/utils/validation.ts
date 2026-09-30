import { z } from 'zod';

// Phone validation - Brazilian format
export const phoneSchema = z
  .string()
  .min(10, 'Telefone deve ter pelo menos 10 dígitos')
  .max(11, 'Telefone deve ter no máximo 11 dígitos')
  .regex(/^\d{10,11}$/, 'Telefone deve conter apenas números')
  .refine((phone) => {
    const ddd = parseInt(phone.substring(0, 2), 10);
    return ddd >= 11 && ddd <= 99;
  }, 'DDD inválido');

// Auth schemas
export const ownerLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const employeeLoginSchema = z.object({
  accessCode: z.string().length(6, 'Código de acesso deve ter 6 dígitos'),
});

export const clientRequestCodeSchema = z.object({
  phone: phoneSchema,
});

export const clientVerifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, 'Código deve ter 6 dígitos'),
});

// Booking schemas
export const checkClientSchema = z.object({
  phone: phoneSchema,
});

export const getSlotsSchema = z.object({
  employeeId: z.string().uuid('ID do funcionário inválido'),
  serviceId: z.string().uuid('ID do serviço inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
});

export const createBookingSchema = z.object({
  serviceId: z.string().uuid('ID do serviço inválido'),
  employeeId: z.string().uuid('ID do funcionário inválido'),
  startsAt: z.string().datetime({ offset: true }),
  client: z.object({
    phone: phoneSchema,
    fullName: z.string().min(2, 'Nome completo obrigatório').max(150).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato YYYY-MM-DD').optional(),
  }),
});

// Remove tudo que não for dígito
export function onlyDigits(value: string): string {
  return (value || '').replace(/\D/g, '');
}

// Máscara de telefone brasileiro: (00) 00000-0000 / (00) 0000-0000
export function formatPhoneInput(value: string): string {
  const d = onlyDigits(value).slice(0, 11);

  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Formata um telefone (somente dígitos) para exibição
export function formatPhone(phone: string): string {
  return formatPhoneInput(phone);
}

// Validate phone input (for real-time validation)
export function validatePhoneInput(value: string): { valid: boolean; error?: string } {
  const numbers = onlyDigits(value);

  if (numbers.length === 0) {
    return { valid: false, error: 'Telefone é obrigatório' };
  }

  if (numbers.length < 10) {
    return { valid: false, error: 'Telefone incompleto' };
  }

  if (numbers.length > 11) {
    return { valid: false, error: 'Telefone muito longo' };
  }

  const ddd = parseInt(numbers.substring(0, 2), 10);
  if (ddd < 11 || ddd > 99) {
    return { valid: false, error: 'DDD inválido' };
  }

  if (numbers.length === 10 || numbers.length === 11) {
    return { valid: true };
  }
  
  return { valid: false, error: 'Complete o telefone' };
}

// Validate birth date
export function validateBirthDate(dateString: string): { valid: boolean; error?: string } {
  if (!dateString) {
    return { valid: false, error: 'Data de nascimento é obrigatória' };
  }
  
  const date = new Date(dateString + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Data inválida' };
  }
  
  if (date > today) {
    return { valid: false, error: 'Data não pode ser no futuro' };
  }
  
  const age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    // idade - 1
  }
  
  if (age > 120) {
    return { valid: false, error: 'Idade inválida' };
  }
  
  return { valid: true };
}

// Generate random ID for client-side use
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}