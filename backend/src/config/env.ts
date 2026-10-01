import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  /**
   * Supabase Storage para as imagens.
   *
   * As três juntas ligam o armazenamento de imagens. Sem elas, o sistema grava
   * no disco — o que funciona em desenvolvimento e NÃO funciona no Vercel,
   * porque função serverless não tem disco. A foto seria "enviada com sucesso"
   * e apareceria quebrada para todo mundo.
   *
   * `SUPABASE_SERVICE_ROLE_KEY` é a chave que burla as políticas de acesso do
   * bucket. Ela é o equivalente a senha de administrador do banco: nunca no
   * frontend, nunca no repositório, nunca em print.
   */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),

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
  /**
   * Token de segurança da conta Z-API (opcional, mas recomendado).
   *
   * Varia do token da instância: este é o header `Client-Token`, e sua função é
   * fazer a Z-API recusar chamadas de IP não autorizado. Sem ele, a URL da
   * instância basta para alguém mandar mensagem em nome do salão.
   */
  WHATSAPP_CLIENT_TOKEN: z.string().optional(),
  /**
   * URL pública do backend, para cadastrar o webhook da Z-API sozinha.
   *
   * A Z-API é quem avisa o sistema quando o WhatsApp cai — o sistema não
   * consulta. Sem esta URL o dono descobriria a queda por um cliente
   * reclamando, que é a forma mais cara de descobrir.
   *
   * Em produção no Vercel, é o domínio do backend, não o do frontend: o
   * webhook aponta para a API.
   */
  BACKEND_URL: z.string().url().optional(),

  // Email (optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  /**
   * Chave das rotinas disparadas de fora (Vercel Cron ou agendador externo).
   *
   * Em produção é OBRIGATÓRIA de verdade: sem ela, `/api/cron/*` responde 503
   * e os lembretes de WhatsApp nunca saem. O sistema continua funcionando,
   * o que torna a falha silenciosa — ninguém percebe até um cliente reclamar
   * que não recebeu o lembrete.
   *
   * O Vercel injeta `CRON_SECRET` sozinho nas requisições de Cron, se você
   * criar uma variável de ambiente com esse nome exato no projeto.
   */
  CRON_SECRET: z.string().min(16).optional(),

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