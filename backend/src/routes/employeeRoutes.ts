import { Router } from 'express';
import * as appointmentController from '@controllers/appointmentController';
import { employeeMiddleware } from '@middlewares/auth';
import { uuidParamSchema, updateAppointmentStatusSchema, listAppointmentsSchema } from '@utils/validation';
import { validateParams, validateBody, validateQuery } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação de funcionário ou dono
router.use(employeeMiddleware);

// Perfil do funcionário
router.get('/profile', asyncHandler(appointmentController.getEmployeeProfile));

// Agendamentos do funcionário
router.get('/appointments', validateQuery(listAppointmentsSchema), asyncHandler(appointmentController.getEmployeeAppointments));
router.get('/appointments/today', asyncHandler(appointmentController.getEmployeeTodayAppointments));
router.get('/appointments/:id', validateParams(uuidParamSchema), asyncHandler(appointmentController.getAppointmentById));
router.patch('/appointments/:id/status', validateParams(uuidParamSchema), validateBody(updateAppointmentStatusSchema), asyncHandler(appointmentController.updateAppointmentStatusController));

export default router;