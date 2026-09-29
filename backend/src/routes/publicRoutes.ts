import { Router } from 'express';
import * as serviceController from '@controllers/serviceController';
import * as employeeController from '@controllers/employeeController';
import * as bookingController from '@controllers/bookingController';
import { bookingRateLimiter } from '@middlewares/rateLimiter';
import {
  getSlotsSchema,
  createBookingSchema,
  cancelBookingSchema,
} from '@utils/validation';
import { validateQuery, validateBody, validateParams } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// Serviços públicos
router.get('/services', asyncHandler(serviceController.getServices));
router.get('/services/:id', asyncHandler(serviceController.getServiceById));

// Funcionários ativos (para agendamento)
router.get('/employees/active', asyncHandler(employeeController.getActiveEmployees));

// Booking público
router.post(
  '/booking/check-client',
  bookingRateLimiter,
  validateBody(cancelBookingSchema.shape.body), // reaproveita schema de phone
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

export default router;