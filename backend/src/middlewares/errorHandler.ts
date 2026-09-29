import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('❌ Error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(error, res);
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'Dados inválidos para o banco de dados',
      code: 'PRISMA_VALIDATION_ERROR',
    });
    return;
  }

  // App errors (nossos erros controlados)
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'Token inválido',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'Token expirado',
      code: 'TOKEN_EXPIRED',
    });
    return;
  }

  // Erro genérico
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Erro interno do servidor'
      : error.message,
    code: 'INTERNAL_ERROR',
  });
}

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError, res: Response): void {
  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.target as string[] | undefined;
      const field = target?.[0] || 'campo';
      res.status(409).json({
        error: `${field} já cadastrado`,
        code: 'DUPLICATE_ENTRY',
        field,
      });
      break;
    }
    case 'P2003': {
      const field = (error.meta?.field_name as string) || 'referência';
      res.status(400).json({
        error: `${field} não encontrado`,
        code: 'FOREIGN_KEY_CONSTRAINT',
        field,
      });
      break;
    }
    case 'P2025': {
      res.status(404).json({
        error: 'Registro não encontrado',
        code: 'NOT_FOUND',
      });
      break;
    }
    default:
      res.status(500).json({
        error: 'Erro no banco de dados',
        code: 'DATABASE_ERROR',
      });
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Rota não encontrada',
    code: 'NOT_FOUND',
    path: req.path,
  });
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}