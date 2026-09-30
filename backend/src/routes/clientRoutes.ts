import { Router } from 'express';
import * as bookingController from '@controllers/bookingController';
import * as appointmentController from '@controllers/appointmentController';
import { authMiddleware, clientMiddleware } from '@middlewares/auth';
import { uuidParamSchema, cancelBookingSchema, listAppointmentsSchema } from '@utils/validation';
import { validateParams, validateBody, validateQuery } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação de cliente
router.use(authMiddleware, clientMiddleware);

// Meus agendamentos
router.get('/appointments', validateQuery(listAppointmentsSchema), asyncHandler(bookingController.getClientAppointments));
router.get('/appointments/:id', validateParams(uuidParamSchema), asyncHandler(appointmentController.getAppointmentById));
router.patch('/appointments/:id/cancel', validateParams(uuidParamSchema), validateBody(cancelBookingSchema), asyncHandler(bookingController.cancelClientAppointment));

export default router;