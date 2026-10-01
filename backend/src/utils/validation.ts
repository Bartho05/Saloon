import { z } from 'zod';

// Phone validation - Brazilian format
export const phoneSchema = z
  .string()
  .min(10, 'Telefone deve ter pelo menos 10 dígitos')
  .max(11, 'Telefone deve ter no máximo 11 dígitos')
  .regex(/^\d{10,11}$/, 'Telefone deve conter apenas números')
  .refine((phone) => {
    // Validar DDD válido (11 a 99)
    const ddd = parseInt(phone.substring(0, 2), 10);
    return ddd >= 11 && ddd <= 99;
  }, 'DDD inválido');

// Auth schemas
export const ownerLoginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

export const employeeLoginSchema = z.object({
  // 6 dígitos. O `.length(6)` sozinho aceitava 'abcdef' e a mensagem de
  // erro prometia um código numérico que o schema não exigia.
  accessCode: z
    .string()
    .length(6, 'Código de acesso deve ter 6 dígitos')
    .regex(/^\d{6}$/, 'Código de acesso deve conter apenas números'),
});

export const clientRequestCodeSchema = z.object({
  phone: phoneSchema,
});

export const clientVerifyCodeSchema = z.object({
  phone: phoneSchema,
  code: z.string().length(6, 'Código deve ter 6 dígitos'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório'),
});

// Service schemas
export const createServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(15, 'Duração mínima 15 minutos').max(480, 'Duração máxima 8 horas'),
  price: z.number().positive('Preço deve ser positivo').max(99999.99),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).optional(),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  price: z.number().positive().max(99999.99).optional(),
  isActive: z.boolean().optional(),
});

// Employee schemas
export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  phone: phoneSchema,
  specialties: z.array(z.string()).min(1, 'Pelo menos uma especialidade'),
  serviceIds: z.array(z.string().uuid()).optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100).optional(),
  phone: phoneSchema.optional(),
  specialties: z.array(z.string()).optional(),
  serviceIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional(),
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
  startsAt: z
    .string()
    .datetime({ offset: true })
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Data/hora inválida (use ISO 8601 com timezone)'),
  client: z.object({
    phone: phoneSchema,
    fullName: z.string().min(2, 'Nome completo obrigatório para novos clientes').max(150).optional(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento no formato YYYY-MM-DD').optional(),
  }),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(200).optional(),
});

// Appointment schemas
export const updateAppointmentStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().max(500).optional(),
});

export const listAppointmentsSchema = z.object({
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Settings schemas
export const updateSettingsSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: phoneSchema.optional(),
  // O formulário manda '' quando o campo está vazio, e `.email()` reprova
  // string vazia: o dono não conseguia salvar nenhuma alteração enquanto o
  // e-mail não estivesse preenchido. String vazia vira null (limpar).
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((v) => (v === '' ? null : v)),
  address: z.string().max(200).optional(),
  businessHours: z
    .object({
      0: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
      1: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
      2: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
      3: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
      4: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
      5: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
      6: z.union([z.null(), z.object({ open: z.string(), close: z.string() })]),
    })
    .optional(),
  birthdayMessage: z.string().max(500).optional(),
  whatsappApiConfig: z
    .object({
      provider: z.enum(['zapi', 'evolution', 'meta']),
      instanceId: z.string(),
      token: z.string(),
      apiUrl: z.string().url(),
    })
    .optional()
    .nullable(),
  cancellationHours: z.number().int().min(0).max(24).optional(),
  bufferMinutes: z.number().int().min(0).max(60).optional(),
  slotInterval: z.number().int().min(15).max(60).optional(),
});

// Financial schemas
export const financialQuerySchema = z.object({
  period: z.enum(['day', 'month', 'year']).default('month'),
  reference: z.coerce.date().optional(),
});

// UUID param schema
export const uuidParamSchema = z.object({
  id: z.string().uuid('ID inválido'),
});