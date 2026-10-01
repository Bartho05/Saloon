import { Router } from 'express';
import * as serviceController from '@controllers/serviceController';
import * as employeeController from '@controllers/employeeController';
import * as bookingController from '@controllers/bookingController';
import * as settingsController from '@controllers/settingsController';
import { bookingRateLimiter } from '@middlewares/rateLimiter';
import {
  getSlotsSchema,
  createBookingSchema,
  checkClientSchema,
} from '@utils/validation';
import { validateQuery, validateBody, validateParams } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { webhooks as whatsappWebhooks } from '@controllers/whatsappController';

const router = Router();

// Serviços públicos
router.get('/services', asyncHandler(serviceController.getServices));
router.get('/services/:id', asyncHandler(serviceController.getServiceById));

// Dados do salão para a landing page — mesma fonte que o dono edita.
// O caminho é `/salon` porque este router é montado na raiz da API (igual a
// `/services`), não sob um prefixo `/public`.
router.get('/salon', asyncHandler(settingsController.getPublicSalon));

// Funcionários ativos (para agendamento)
router.get('/employees/active', asyncHandler(employeeController.getActiveEmployees));

// Booking público
router.post(
  '/booking/check-client',
  bookingRateLimiter,
  validateBody(checkClientSchema),
  asyncHandler(bookingController.checkClient)
);

router.get(
  '/booking/slots',
  validateQuery(getSlotsSchema),
  asyncHandler(bookingController.getSlots)
);

router.post(
  '/booking/create',
  bookingRateLimiter,
  validateBody(createBookingSchema),
  asyncHandler(bookingController.createBookingController)
);

// Rotas para página pública de agendamento
router.get('/booking/public-services', asyncHandler(bookingController.getPublicServices));
router.get('/booking/public-employees', asyncHandler(bookingController.getPublicEmployees));

/**
 * Webhook da Z-API.
 *
 * Pública de propósito: quem chama é a Z-API, que não tem sessão nem token
 * nosso. A proteção está em não haver o que proteger — a rota só grava no log
 * de auditoria e devolve `ok`. Ela responde 200 sempre, porque a Z-API reenvia
 * em caso de erro e um 500 aqui viraria loop de requisições.
 *
 * Não entra no rate limiter de propósito: a Z-API dispara vários eventos em
 * sequência quando o celular reconecta, e uma delas ser barrada seria perder
 * justamente o alerta de reconexão.
 */
router.post('/whatsapp/webhook', whatsappWebhooks);

export default router;