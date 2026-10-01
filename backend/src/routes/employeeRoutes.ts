import { Router } from 'express';
import * as appointmentController from '@controllers/appointmentController';
import * as employeeController from '@controllers/employeeController';
import { authMiddleware, employeeMiddleware } from '@middlewares/auth';
import { uuidParamSchema, updateAppointmentStatusSchema, listAppointmentsSchema, financialQuerySchema } from '@utils/validation';
import { validateParams, validateBody, validateQuery } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { uploadImage } from '@services/uploadService';

const router = Router();

// Todas as rotas requerem autenticação de funcionário ou dono
router.use(authMiddleware, employeeMiddleware);

// Perfil do funcionário
router.get('/profile', asyncHandler(employeeController.getEmployeeProfile));

// Agendamentos do funcionário
router.get('/appointments', validateQuery(listAppointmentsSchema), asyncHandler(appointmentController.getEmployeeAppointments));
router.get('/appointments/today', asyncHandler(appointmentController.getEmployeeTodayAppointments));
router.get('/appointments/:id', validateParams(uuidParamSchema), asyncHandler(appointmentController.getAppointmentById));
router.patch('/appointments/:id/status', validateParams(uuidParamSchema), validateBody(updateAppointmentStatusSchema), asyncHandler(appointmentController.updateAppointmentStatusController));

// Controle financeiro do próprio funcionário
router.get('/financial', validateQuery(financialQuerySchema), asyncHandler(employeeController.getMyFinancials));

// Foto do rosto
router.patch('/photo', uploadImage.single('photo'), asyncHandler(employeeController.uploadMyPhoto));
router.delete('/photo', asyncHandler(employeeController.removeMyPhoto));

// NÃO há rota de dados do salão para o funcionário. Ele pertence àquele
// salão: nome, endereço e horário são do proprietário. A tela "Salão" da
// sidebar do funcionário foi removida junto com estas rotas.

export default router;