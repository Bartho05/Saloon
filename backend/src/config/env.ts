import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  // WhatsApp
  WHATSAPP_PROVIDER: z.enum(['zapi', 'evolution', 'meta']).default('zapi'),
  WHATSAPP_INSTANCE_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_API_URL: z.string().url().default('https://api.z-api.io'),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Rate Limiting
  //
  // 600 por 15 min ≈ 40/min. O padrão era 100 (≈7/min), que uma SPA estoura
  // em cinco telas — ver comentário em `rateLimiter.ts`.
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(600),

  // Superadmin
  //
  // Pepper do código de acesso. Vai na entrada do scrypt e NÃO no banco: com
  // o banco inteiro vazado, quem não tem esta variável não consegue nem
  // recalcular o hash para testar candidatos.
  //
  // Sem valor padrão de propósito. Sem ela o servidor não sobe, e um pepper
  // fixo no código-fonte seria pior que nada — daria a impressão de proteção
  // sem existir.
  SUPERADMIN_PEPPER: z.string().min(16, 'SUPERADMIN_PEPPER precisa de ao menos 16 caracteres'),

  /**
   * Semente do bootstrap.
   *
   * Enquanto não existir superadmin, `POST /superadmin/bootstrap` cria o
   * primeiro. Essa porta aberta é perigosa por definição, então só existe se o
   * operador colocar uma semente no `.env` — o valor que ele precisa informar
   * para autorizar a criação. Sem a semente, o endpoint responde 503 mesmo com
   * o banco vazio.
   */
  SUPERADMIN_BOOTSTRAP_SEED: z.string().min(16).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Variáveis de ambiente inválidas:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export const env = getEnv();