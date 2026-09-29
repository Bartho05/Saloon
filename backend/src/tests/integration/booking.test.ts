import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '@app';
import prisma from '@config/database';
import bcrypt from 'bcryptjs';

describe('Booking Integration Tests', () => {
  let ownerToken: string;
  let employeeToken: string;
  let employeeId: string;
  let serviceId: string;
  let clientPhone = '11999998888';

  beforeAll(async () => {
    // Limpa banco de teste
    await prisma.appointment.deleteMany();
    await prisma.client.deleteMany();
    await prisma.service.deleteMany();
    await prisma.user.deleteMany({ where: { role: 'EMPLOYEE' } });
    await prisma.user.deleteMany({ where: { role: 'OWNER' } });

    // Cria owner
    const passwordHash = await bcrypt.hash('123456', 10);
    const owner = await prisma.user.create({
      data: {
        name: 'Dono Teste',
        email: 'owner@test.com',
        phone: '11999990000',
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });

    // Login owner
    const ownerLogin = await request(app)
      .post('/auth/owner/login')
      .send({ email: 'owner@test.com', password: '123456' });
    ownerToken = ownerLogin.body.accessToken;

    // Cria funcionário
    const employee = await prisma.user.create({
      data: {
        name: 'Funcionário Teste',
        phone: '11988887777',
        specialties: ['Corte', 'Barba'],
        accessCode: '123456',
        role: 'EMPLOYEE',
        isActive: true,
      },
    });
    employeeId = employee.id;

    // Login funcionário
    const empLogin = await request(app)
      .post('/auth/employee/login')
      .send({ accessCode: '123456' });
    employeeToken = empLogin.body.accessToken;

    // Cria serviço
    const service = await prisma.service.create({
      data: {
        name: 'Corte Masculino',
        durationMinutes: 30,
        price: 50.00,
        isActive: true,
      },
    });
    serviceId = service.id;

    // Configura horários do salão
    await prisma.salonSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        name: 'Salão Teste',
        businessHours: {
          0: null,
          1: { open: '09:00', close: '19:00' },
          2: { open: '09:00', close: '19:00' },
          3: { open: '09:00', close: '19:00' },
          4: { open: '09:00', close: '19:00' },
          5: { open: '09:00', close: '19:00' },
          6: { open: '09:00', close: '17:00' },
        },
      },
      update: {},
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.appointment.deleteMany();
    await prisma.client.deleteMany();
  });

  describe('POST /booking/check-client', () => {
    it('should return exists: false for unknown phone', async () => {
      const res = await request(app)
        .post('/booking/check-client')
        .send({ phone: '11999997777' })
        .expect(200);

      expect(res.body.exists).toBe(false);
    });

    it('should return exists: true for known client', async () => {
      await prisma.client.create({
        data: {
          fullName: 'Cliente Existente',
          phone: clientPhone,
          birthDate: new Date('1990-01-01'),
        },
      });

      const res = await request(app)
        .post('/booking/check-client')
        .send({ phone: clientPhone })
        .expect(200);

      expect(res.body.exists).toBe(true);
      expect(res.body.client.fullName).toBe('Cliente Existente');
    });
  });

  describe('GET /booking/slots', () => {
    it('should return available slots for a day', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const res = await request(app)
        .get('/booking/slots')
        .query({ employeeId, serviceId, date: dateStr })
        .expect(200);

      expect(res.body.slots).toBeDefined();
      expect(Array.isArray(res.body.slots)).toBe(true);
      expect(res.body.grouped).toBeDefined();
      expect(res.body.blocked).toBe(false);
    });

    it('should return blocked for Sunday', async () => {
      const sunday = new Date();
      sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
      const dateStr = sunday.toISOString().split('T')[0];

      const res = await request(app)
        .get('/booking/slots')
        .query({ employeeId, serviceId, date: dateStr })
        .expect(200);

      expect(res.body.blocked).toBe(true);
      expect(res.body.reason).toBe('Dia de fechamento semanal');
    });

    it('should respect existing appointments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Cria agendamento existente
      await prisma.appointment.create({
        data: {
          clientId: (await prisma.client.create({
            data: { fullName: 'Outro Cliente', phone: '11888887777', birthDate: new Date('1990-01-01') },
          })).id,
          employeeId,
          serviceId,
          startsAt: tomorrow,
          endsAt: new Date(tomorrow.getTime() + 30 * 60000),
          status: 'SCHEDULED',
        },
      });

      const res = await request(app)
        .get('/booking/slots')
        .query({ employeeId, serviceId, date: dateStr })
        .expect(200);

      // Slot das 10:00 deve estar indisponível
      const slot10 = res.body.slots.find((s: any) =>
        s.start.includes('T10:00:00')
      );
      expect(slot10?.available).toBe(false);
    });
  });

  describe('POST /booking/create', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const startsAt = tomorrow.toISOString();

    it('should create booking and new client', async () => {
      const res = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: {
            phone: '11977776666',
            fullName: 'Novo Cliente',
            birthDate: '1995-05-20',
          },
        })
        .expect(201);

      expect(res.body.appointment).toBeDefined();
      expect(res.body.client.fullName).toBe('Novo Cliente');
      expect(res.body.isNewClient).toBe(true);
      expect(res.body.appointment.status).toBe('SCHEDULED');
    });

    it('should create booking for existing client', async () => {
      // Cria cliente primeiro
      const client = await prisma.client.create({
        data: {
          fullName: 'Cliente Existente',
          phone: clientPhone,
          birthDate: new Date('1990-01-01'),
        },
      });

      const res = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: { phone: clientPhone },
        })
        .expect(201);

      expect(res.body.isNewClient).toBe(false);
      expect(res.body.client.id).toBe(client.id);
    });

    it('should reject booking for occupied slot', async () => {
      // Cria agendamento existente
      await prisma.appointment.create({
        data: {
          clientId: (await prisma.client.create({
            data: { fullName: 'Outro', phone: '11888887777', birthDate: new Date('1990-01-01') },
          })).id,
          employeeId,
          serviceId,
          startsAt: new Date(startsAt),
          endsAt: new Date(new Date(startsAt).getTime() + 30 * 60000),
          status: 'SCHEDULED',
        },
      });

      const res = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: { phone: '11977776666', fullName: 'Teste', birthDate: '1990-01-01' },
        })
        .expect(409);

      expect(res.body.error).toContain('Horário');
    });

    it('should reject booking without name/birthDate for new client', async () => {
      const res = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: { phone: '11966665555' }, // sem nome e nascimento
        })
        .expect(400);

      expect(res.body.error).toContain('nome completo');
    });
  });

  describe('Client appointments flow', () => {
    let clientToken: string;
    let appointmentId: string;

    beforeEach(async () => {
      // Cria cliente e agendamento
      const client = await prisma.client.create({
        data: {
          fullName: 'Cliente App',
          phone: '11955554444',
          birthDate: new Date('1990-01-01'),
        },
      });

      const appointment = await prisma.appointment.create({
        data: {
          clientId: client.id,
          employeeId,
          serviceId,
          startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // amanhã
          endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + 30 * 60000),
          status: 'SCHEDULED',
        },
      });
      appointmentId = appointment.id;

      // Login cliente (simula verificação de código)
      const verifyRes = await request(app)
        .post('/auth/client/verify-code')
        .send({ phone: '11955554444', code: '123456' });
      clientToken = verifyRes.body.accessToken;
    });

    it('should list client appointments', async () => {
      const res = await request(app)
        .get('/client/appointments')
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200);

      expect(res.body.appointments.length).toBe(1);
      expect(res.body.appointments[0].id).toBe(appointmentId);
    });

    it('should allow client to cancel own appointment', async () => {
      const res = await request(app)
        .patch(`/client/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ reason: 'Não posso ir' })
        .expect(200);

      expect(res.body.message).toBe('Agendamento cancelado com sucesso');

      // Verifica se cancelou
      const apt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      expect(apt?.status).toBe('CANCELLED');
    });

    it('should reject cancellation of completed appointment', async () => {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: 'COMPLETED' },
      });

      const res = await request(app)
        .patch(`/client/appointments/${appointmentId}/cancel`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(400);

      expect(res.body.error).toContain('apenas agendamentos agendados');
    });
  });
});