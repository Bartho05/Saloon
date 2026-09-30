import { Router } from 'express';
import * as authController from '@controllers/authController';
import { authRateLimiter } from '@middlewares/rateLimiter';
import {
  ownerLoginSchema,
  employeeLoginSchema,
  clientRequestCodeSchema,
  clientVerifyCodeSchema,
  refreshTokenSchema,
} from '@utils/validation';
import { validateBody } from '@middlewares/validate';
import { asyncHandler } from '@middlewares/errorHandler';
import { authMiddleware, type AuthRequest } from '@middlewares/auth';

const router = Router();

// POST /auth/owner/login
router.post(
  '/owner/login',
  authRateLimiter,
  validateBody(ownerLoginSchema),
  asyncHandler(authController.ownerLogin)
);

// POST /auth/employee/login
router.post(
  '/employee/login',
  authRateLimiter,
  validateBody(employeeLoginSchema),
  asyncHandler(authController.employeeLogin)
);

// POST /auth/client/request-code
router.post(
  '/client/request-code',
  authRateLimiter,
  validateBody(clientRequestCodeSchema),
  asyncHandler(authController.clientRequestCode)
);

// POST /auth/client/verify-code
router.post(
  '/client/verify-code',
  authRateLimiter,
  validateBody(clientVerifyCodeSchema),
  asyncHandler(authController.clientVerifyCode)
);

// POST /auth/refresh
router.post(
  '/refresh',
  validateBody(refreshTokenSchema),
  asyncHandler(authController.refreshToken)
);

// POST /auth/logout
router.post('/logout', authMiddleware, asyncHandler(authController.logout));

// GET /auth/me
router.get('/me', authMiddleware, asyncHandler(authController.getMe as (req: AuthRequest, res: any) => Promise<void>));

export default router;