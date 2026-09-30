import { Router } from 'express';
import * as serviceController from '@controllers/serviceController';
import * as employeeController from '@controllers/employeeController';
import * as appointmentController from '@controllers/appointmentController';
import * as settingsController from '@controllers/settingsController';
import { authMiddleware, ownerMiddleware } from '@middlewares/auth';
import {
  createServiceSchema,
  updateServiceSchema,
  uuidParamSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  updateSettingsSchema,
  financialQuerySchema,
} from '@utils/validation';
import { validateBody, validateParams, validateQuery } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';

const router = Router();

// Todas as rotas requerem autenticação de owner
router.use(authMiddleware, ownerMiddleware);

// Dashboard
router.get('/appointments/today', asyncHandler(appointmentController.getTodayAppointments));

// Serviços
router.get('/services', asyncHandler(serviceController.getAllServices));
router.post('/services', validateBody(createServiceSchema), asyncHandler(serviceController.createService));
router.patch('/services/:id', validateParams(uuidParamSchema), validateBody(updateServiceSchema), asyncHandler(serviceController.updateService));
router.delete('/services/:id', validateParams(uuidParamSchema), asyncHandler(serviceController.deleteService));

// Funcionários
router.get('/employees', asyncHandler(employeeController.getEmployees));
router.post('/employees', validateBody(createEmployeeSchema), asyncHandler(employeeController.createEmployee));
router.get('/employees/:id', validateParams(uuidParamSchema), asyncHandler(employeeController.getEmployeeById));
router.patch('/employees/:id', validateParams(uuidParamSchema), validateBody(updateEmployeeSchema), asyncHandler(employeeController.updateEmployee));
router.post('/employees/:id/regenerate-code', validateParams(uuidParamSchema), asyncHandler(employeeController.regenerateAccessCode));
router.delete('/employees/:id', validateParams(uuidParamSchema), asyncHandler(employeeController.deleteEmployee));

// Agendamentos (visão geral)
router.get('/appointments', asyncHandler(appointmentController.getAllAppointments));

// Configurações
router.get('/settings', asyncHandler(settingsController.getSettings));
router.patch('/settings', validateBody(updateSettingsSchema), asyncHandler(settingsController.updateSettings));
router.post('/settings/test-whatsapp', asyncHandler(settingsController.testWhatsApp));
router.post('/settings/run-birthday-job', asyncHandler(settingsController.runBirthdayJob));
router.post('/settings/run-reminder-job', asyncHandler(settingsController.runReminderJob));

// Financeiro
router.get('/financial', validateQuery(financialQuerySchema), asyncHandler(settingsController.getFinancialOverview));

export default router;