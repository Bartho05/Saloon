import { Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '@config/database';
import { AuthRequest } from '@middlewares/auth';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  uuidParamSchema,
} from '@utils/validation';
import { AppError } from '@middlewares/errorHandler';
import { sendEmployeeAccessCode } from '@services/whatsappService';
import { invalidateWhatsAppCache } from '@services/whatsappService';

function generateAccessCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * GET /owner/employees
 * Lista funcionários (owner)
 */
export async function getEmployees(req: AuthRequest, res: Response): Promise<void> {
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: { appointments: true },
      },
    },
  });

  // Busca serviços de cada funcionário
  const employeesWithServices = await Promise.all(
    employees.map(async (emp) => {
      const services = await prisma.service.findMany({
        where: {
          appointments: {
            some: { employeeId: emp.id },
          },
        },
        select: { id: true, name: true },
      });
      return { ...emp, services };
    })
  );

  res.json({ employees: employeesWithServices });
}

/**
 * GET /employees/active
 * Lista funcionários ativos com especialidades (público para agendamento)
 */
export async function getActiveEmployees(req: AuthRequest, res: Response): Promise<void> {
  const employees = await prisma.user.findMany({
    where: { role: 'EMPLOYEE', isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      specialties: true,
      _count: {
        select: { appointments: true },
      },
    },
  });

  res.json({ employees });
}

/**
 * POST /owner/employees
 * Cria funcionário (owner)
 */
export async function createEmployee(req: AuthRequest, res: Response): Promise<void> {
  const { name, phone, specialties } = req.body;

  // Verifica se telefone já existe
  const existingPhone = await prisma.user.findUnique({ where: { phone } });
  if (existingPhone) {
    throw new AppError('Telefone já cadastrado', 409, 'PHONE_EXISTS');
  }

  const accessCode = generateAccessCode();

  // Verifica se código já existe (improvável mas seguro)
  let codeExists = await prisma.user.findUnique({ where: { accessCode } });
  while (codeExists) {
    const newCode = generateAccessCode();
    codeExists = await prisma.user.findUnique({ where: { accessCode: newCode } });
  }

  const employee = await prisma.user.create({
    data: {
      name,
      phone,
      specialties,
      accessCode,
      role: 'EMPLOYEE',
      isActive: true,
    },
  });

  // Os serviços que o funcionário realiza ficam no campo `specialties`.

  // Envia código por WhatsApp (se configurado)
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  if (settings) {
    await sendEmployeeAccessCode(phone, name, accessCode, settings.name);
  }

  res.status(201).json({
    employee: {
      id: employee.id,
      name: employee.name,
      phone: employee.phone,
      specialties: employee.specialties,
      accessCode: employee.accessCode,
      isActive: employee.isActive,
    },
  });
}

/**
 * GET /owner/employees/:id
 * Busca funcionário por ID (owner)
 */
export async function getEmployeeById(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const employee = await prisma.user.findUnique({
    where: { id, role: 'EMPLOYEE' },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!employee) {
    throw new AppError('Funcionário não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
  }

  res.json({ employee });
}

/**
 * PATCH /owner/employees/:id
 * Atualiza funcionário (owner)
 */
export async function updateEmployee(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const data = req.body;

  // Se está mudando telefone, verifica duplicata
  if (data.phone) {
    const existing = await prisma.user.findFirst({
      where: { phone: data.phone, NOT: { id } },
    });
    if (existing) {
      throw new AppError('Telefone já cadastrado', 409, 'PHONE_EXISTS');
    }
  }

  const employee = await prisma.user.update({
    where: { id, role: 'EMPLOYEE' },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
    },
  });

  // Invalida cache WhatsApp se config mudou
  invalidateWhatsAppCache();

  res.json({ employee });
}

/**
 * POST /owner/employees/:id/regenerate-code
 * Regenera código de acesso do funcionário
 */
export async function regenerateAccessCode(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const newAccessCode = generateAccessCode();

  const employee = await prisma.user.update({
    where: { id, role: 'EMPLOYEE' },
    data: { accessCode: newAccessCode },
    select: { id: true, name: true, phone: true, accessCode: true },
  });

  // Envia novo código por WhatsApp
  const settings = await prisma.salonSettings.findUnique({
    where: { id: 1 },
    select: { name: true },
  });

  if (settings) {
    await sendEmployeeAccessCode(employee.phone, employee.name, newAccessCode, settings.name);
  }

  res.json({ employee });
}

/**
 * DELETE /owner/employees/:id
 * Desativa funcionário (owner) - soft delete
 */
export async function deleteEmployee(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  // Verifica agendamentos futuros
  const futureAppointments = await prisma.appointment.count({
    where: {
      employeeId: id,
      status: 'SCHEDULED',
      startsAt: { gte: new Date() },
    },
  });

  if (futureAppointments > 0) {
    throw new AppError(
      'Não é possível desativar funcionário com agendamentos futuros',
      400,
      'HAS_FUTURE_APPOINTMENTS'
    );
  }

  await prisma.user.update({
    where: { id, role: 'EMPLOYEE' },
    data: { isActive: false },
  });

  res.json({ message: 'Funcionário desativado com sucesso' });
}

/**
 * GET /employee/profile
 * Perfil do funcionário logado
 */
export async function getEmployeeProfile(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity) || entity.role === 'OWNER') {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const employee = await prisma.user.findUnique({
    where: { id: entity.id },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}