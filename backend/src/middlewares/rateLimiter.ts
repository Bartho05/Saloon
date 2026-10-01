import rateLimit from 'express-rate-limit';
import { env } from '@config/env';

/**
 * Os limitadores ficam DESLIGADOS em `NODE_ENV=test`.
 *
 * A suíte de integração dispara dezenas de logins em sequência e batia no
 * limite de 10 tentativas por 15 minutos — o 429 mascarava a asserção que o
 * teste queria verificar (`.expect(401)` recebia 429 e a falha apontava para
 * o login, não para o limitador).
 *
 * O limitador é comportamento de infraestrutura, não de negócio: a cobertura
 * dele, se necessária, deve vir de um teste próprio que o habilite
 * explicitamente, em vez de toda requisição da suíte tropeçar nele.
 */
const isTest = env.NODE_ENV === 'test';
const skipInTests = () => isTest;

export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Muitas requisições. Tente novamente mais tarde.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // 10 tentativas por janela
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // só conta tentativas malsucedidas: quem acerta o login não gasta cota
  skipSuccessfulRequests: true,
  skip: skipInTests,
});

export const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20, // 20 requisições por minuto
  message: {
    error: 'Muitas requisições de agendamento. Aguarde um momento.',
    code: 'BOOKING_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});

export const whatsappRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 mensagens por minuto
  message: {
    error: 'Limite de envio de WhatsApp atingido. Aguarde.',
    code: 'WHATSAPP_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
});