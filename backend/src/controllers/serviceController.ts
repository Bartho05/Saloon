import { Response } from 'express';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import {
  createServiceSchema,
  updateServiceSchema,
  uuidParamSchema,
  listAppointmentsSchema,
} from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';

/**
 * GET /services
 * Lista serviços ativos (público)
 */
export async function getServices(req: AuthRequest, res: Response): Promise<void> {
  const services = await prisma.service.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      price: true,
    },
  });

  res.json({ services });
}

/**
 * GET /services/:id
 * Busca serviço por ID (público)
 */
export async function getServiceById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const service = await prisma.service.findUnique({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      price: true,
    },
  });

  if (!service) {
    throw new AppError('Serviço não encontrado', 404, 'SERVICE_NOT_FOUND');
  }

  res.json({ service });
}

/**
 * POST /owner/services
 * Cria novo serviço (owner)
 */
export async function createService(req: AuthRequest, res: Response): Promise<void> {
  const { name, description, durationMinutes, price } = req.body;

  const service = await prisma.service.create({
    data: {
      name,
      description,
      durationMinutes,
      price,
    },
  });

  res.status(201).json({ service });
}

/**
 * PATCH /owner/services/:id
 * Atualiza serviço (owner)
 */
export async function updateService(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  const service = await prisma.service.update({
    where: { id },
    data,
  });

  res.json({ service });
}

/**
 * DELETE /owner/services/:id
 * Desativa serviço (owner) - soft delete
 */
export async function deleteService(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // Verifica se tem agendamentos futuros
  const futureAppointments = await prisma.appointment.count({
    where: {
      serviceId: id,
      status: 'SCHEDULED',
      startsAt: { gte: new Date() },
    },
  });

  if (futureAppointments > 0) {
    throw new AppError(
      'Não é possível desativar serviço com agendamentos futuros',
      400,
      'HAS_FUTURE_APPOINTMENTS'
    );
  }

  await prisma.service.update({
    where: { id },
    data: { isActive: false },
  });

  res.json({ message: 'Serviço desativado com sucesso' });
}

/**
 * GET /owner/services
 * Lista todos os serviços (incluindo inativos) para owner
 */
export async function getAllServices(req: AuthRequest, res: Response): Promise<void> {
  const services = await prisma.service.findMany({
    orderBy: { name: 'asc' },
  });

  res.json({ services });
}