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
import { getFinancialSummary } from '@services/financialService';
import { persistImage, removeImage } from '@services/uploadService';

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
      photoUrl: true,
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
    // inclui o OWNER: ele também atende e precisa aparecer na lista
    where: { role: { in: ['EMPLOYEE', 'OWNER'] }, isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      specialties: true,
      // o cliente vê a foto de quem vai atendê-lo
      photoUrl: true,
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

  if (!entity || !('role' in entity)) {
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
      photoUrl: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}

/**
 * PATCH /employee/photo
 * O próprio funcionário envia a foto do rosto.
 */
export async function uploadMyPhoto(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const file = req.file;
  if (!file) {
    throw new AppError('Envie um arquivo de imagem', 400, 'FILE_REQUIRED');
  }

  const current = await prisma.user.findUnique({
    where: { id: entity.id },
    select: { photoUrl: true },
  });

  const photoUrl = persistImage(file.path, 'employees', entity.id);

  // remove a anterior só depois que a nova está no disco
  removeImage(current?.photoUrl);

  const employee = await prisma.user.update({
    where: { id: entity.id },
    data: { photoUrl },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}

/**
 * DELETE /employee/photo
 */
export async function removeMyPhoto(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const current = await prisma.user.findUnique({
    where: { id: entity.id },
    select: { photoUrl: true },
  });

  removeImage(current?.photoUrl);

  const employee = await prisma.user.update({
    where: { id: entity.id },
    data: { photoUrl: null },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}

/**
 * PATCH /owner/employees/:id/photo
 * O dono envia a foto de um funcionário.
 */
export async function uploadEmployeePhoto(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    throw new AppError('Envie um arquivo de imagem', 400, 'FILE_REQUIRED');
  }

  const { id } = req.params;
  const current = await prisma.user.findUnique({
    where: { id },
    select: { photoUrl: true },
  });

  if (!current) {
    removeImage(persistImage(file.path, 'employees', id));
    throw new AppError('Funcionário não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
  }

  const photoUrl = persistImage(file.path, 'employees', id);
  removeImage(current.photoUrl);

  const employee = await prisma.user.update({
    where: { id },
    data: { photoUrl },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}

/**
 * DELETE /owner/employees/:id/photo
 * O dono remove a foto de um funcionário (volta para a inicial).
 */
export async function removeEmployeePhoto(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const current = await prisma.user.findUnique({
    where: { id },
    select: { photoUrl: true },
  });

  if (!current) {
    throw new AppError('Funcionário não encontrado', 404, 'EMPLOYEE_NOT_FOUND');
  }

  removeImage(current.photoUrl);

  const employee = await prisma.user.update({
    where: { id },
    data: { photoUrl: null },
    select: {
      id: true,
      name: true,
      phone: true,
      specialties: true,
      accessCode: true,
      isActive: true,
      photoUrl: true,
      createdAt: true,
    },
  });

  res.json({ employee });
}

/**
 * GET /employee/financial
 * Controle financeiro do PRÓPRIO funcionário (dia / mês / ano).
 * O employeeId vem sempre do token — nunca da query — para que um
 * funcionário não consiga ver o faturamento de outro.
 */
export async function getMyFinancials(req: AuthRequest, res: Response): Promise<void> {
  const entity = req.userEntity;

  if (!entity || !('role' in entity)) {
    throw new AppError('Acesso restrito a funcionários', 403, 'FORBIDDEN');
  }

  const { period = 'month', reference } = req.query as {
    period?: 'day' | 'month' | 'year';
    /** 'YYYY-MM-DD' crua: a conversão para o fuso do salão é do serviço. */
    reference?: string;
  };

  const summary = await getFinancialSummary(entity.id, period, reference);

  res.json({ financial: summary });
}