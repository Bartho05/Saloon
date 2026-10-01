import { Router } from 'express';
import * as superadminController from '@controllers/superadminController';
import { authMiddleware, superAdminMiddleware } from '@middlewares/auth';
import { validateBody, validateParams } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { superadminSchema } from '@utils/validation';
import { superAdminRateLimiter } from '@middlewares/rateLimiter';
import { z } from 'zod';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Rotas públicas do superadmin
//
// São as três que funcionam SEM superadmin existir — sem elas não haveria como
// criar o primeiro.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /superadmin/bootstrap-status
 *
 * A tela de login usa isso para decidir entre "entre com seu código" e
 * "instalar o primeiro acesso". Não devolve nada além do booleano: qualquer
 * informação a mais serviria ao atacante.
 */
router.get('/bootstrap-status', asyncHandler(superadminController.bootstrapStatus));

/**
 * POST /superadmin/bootstrap
 *
 * Cria o primeiro superadmin. Protegido pela semente do `.env`, e a porta se
 * fecha sozinha assim que existe um superadmin — a segunda tentativa cai em 409.
 */
router.post(
  '/bootstrap',
  superAdminRateLimiter,
  validateBody(superadminSchema.bootstrap),
  asyncHandler(superadminController.bootstrap)
);

/**
 * POST /superadmin/login
 *
 * Limite próprio e bem mais apertado que o de login comum (5 tentativas por 15
 * minutos contra 10): é o acesso que cria o primeiro proprietário, então é o
 * que mais vale tentar adivinhar.
 */
router.post(
  '/login',
  superAdminRateLimiter,
  validateBody(superadminSchema.login),
  asyncHandler(superadminController.login)
);

// ─────────────────────────────────────────────────────────────────────────────
// A partir daqui, sessão de superadmin obrigatória
// ─────────────────────────────────────────────────────────────────────────────
router.use(authMiddleware, superAdminMiddleware);

/** GET /superadmin/overview — estado da instalação e o que falta. */
router.get('/overview', asyncHandler(superadminController.overview));

/** GET /superadmin/accounts */
router.get('/accounts', asyncHandler(superadminController.listAccounts));

/** GET /superadmin/audit */
router.get('/audit', asyncHandler(superadminController.listAuditLog));

/** POST /superadmin/rotate-code */
router.post('/rotate-code', asyncHandler(superadminController.rotateCode));

/**
 * Proprietários.
 *
 * Criar o primeiro dono é o passo que destrava a instalação inteira, e é por
 * isso que vive aqui e não no painel do dono: no momento em que ele existe,
 * ainda não existe dono para logar.
 */
router.get('/owners', asyncHandler(superadminController.listOwners));
router.post(
  '/owners',
  validateBody(superadminSchema.createOwner),
  asyncHandler(superadminController.createOwner)
);

const idParams = z.object({ id: z.coerce.number().int().positive() });

/** POST /superadmin/:id/unlock */
router.post(
  '/:id/unlock',
  validateParams(idParams),
  asyncHandler(superadminController.unlock)
);

/** PATCH /superadmin/:id/active */
router.patch(
  '/:id/active',
  validateParams(idParams),
  validateBody(superadminSchema.setActive),
  asyncHandler(superadminController.setActive)
);

export default router;
