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

/**
 * Limite global.
 *
 * O valor padrão anterior era 100 requisições por 15 minutos — cerca de 7 por
 * minuto. Uma tela do painel já dispara de 2 a 4 chamadas (dados da página +
 * perfil + configuração do salão), então navegar por cinco telas já estourava
 * a cota. O efeito prático era o dono ser jogado para a tela de login no meio
 * do trabalho, sem ele ter feito nada de errado.
 *
 * O limite existe para conter script abusing a API, não para contar a
 * navegação de uma pessoa. 600 por 15 minutos dá folga para uso intenso
 * (uma tela a cada 2 segundos, o que ninguém faz) e ainda derruba loop.
 *
 * Quem quiser apertar, ajusta por variável de ambiente.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Você fez muitas requisições em pouco tempo. Aguarde alguns instantes e tente de novo.',
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

/**
 * Limite do login de superadmin.
 *
 * Bem mais apertado que o de login comum (5 contra 10 por 15 minutos). É o
 * acesso que cria o primeiro proprietário, então é o alvo mais tentador que
 * existe na aplicação: quem o obtém controla a instalação inteira. O
 * `skipSuccessfulRequests` evita que o superadmin legítimo, que pode entrar
 * algumas vezes ao dia, consuma a própria cota.
 */
export const superAdminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas por janela
  message: {
    error: 'Muitas tentativas. Aguarde 15 minutos antes de tentar de novo.',
    code: 'SUPERADMIN_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
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