import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '@app';
import prisma from '@config/database';
import bcrypt from 'bcryptjs';

/**
 * `date.toISOString().split('T')[0]` devolve a data em UTC, não a local.
 *
 * O `?date=` da API é um dia civil do salão (horário de Brasília), então
 * usar UTC faz o teste consultar o dia errado: às 21h local de um domingo,
 * o ISO já é segunda-feira. Estos testes rodavam e passavam às 10h da
 * manhã e falhavam à noite — o defeito estava escondido pelo relógio.
 */
const localDateKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

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
      const dateStr = localDateKey(tomorrow);

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
      // +7 se já for domingo, senão avança até o próximo
      sunday.setDate(sunday.getDate() + (sunday.getDay() === 0 ? 7 : 7 - sunday.getDay()));
      const dateStr = localDateKey(sunday);

      // sanidade: o dia escolhido tem que ser realmente domingo
      expect(sunday.getDay()).toBe(0);

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
      const dateStr = localDateKey(tomorrow);

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

      // A API devolve os slots em ISO/UTC. 10:00 de Brasília é 13:00 UTC —
      // comparar com 'T10:00:00' nunca encontrava nada e o teste passava
      // por `slot10?.available === undefined`... que aliás é exatamente a
      // falha que ele devia dar. Busca pelo instante real do agendamento.
      const slot10 = res.body.slots.find(
        (s: any) => new Date(s.start).getTime() === tomorrow.getTime()
      );

      expect(slot10).toBeDefined();
      expect(slot10.available).toBe(false);
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

    /**
     * Regressão do bug do "Cliente WhatsApp".
     *
     * O telefone pode ter registro criado pela verificação por WhatsApp, sem
     * nome nem nascimento. Antes esse registro era tratado como cliente
     * pronto: o agendamento aceitava a chamada sem nome e o nome ficava
     * vazio (ou o placeholder) na agenda do dono e do profissional para
     * sempre, sem caminho para corrigir. Agora cadastro incompleto exige
     * nome e nascimento, mesmo com o registro já existindo.
     */
    it('should require name and birthDate for an incomplete existing record', async () => {
      // Telefone verificado por WhatsApp: registro existe, cadastro não.
      await prisma.client.create({
        data: { phone: '11955550001', fullName: '', birthDate: null },
      });

      const semDados = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: { phone: '11955550001' }, // sem nome e nascimento
        })
        .expect(400);

      expect(semDados.body.code).toBe('CLIENT_DATA_REQUIRED');

      // E o registro continua incompleto: nada foi inventado.
      const aindaIncompleto = await prisma.client.findUnique({
        where: { phone: '11955550001' },
      });
      expect(aindaIncompleto?.fullName).toBe('');
      expect(aindaIncompleto?.birthDate).toBeNull();
    });

    it('should fill an incomplete existing record with the typed name', async () => {
      await prisma.client.create({
        data: { phone: '11955550002', fullName: '', birthDate: null },
      });

      const res = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: {
            phone: '11955550002',
            fullName: 'Maria Nome Digitado',
            birthDate: '1992-04-05',
          },
        })
        .expect(201);

      expect(res.body.client.fullName).toBe('Maria Nome Digitado');

      const gravado = await prisma.client.findUnique({
        where: { phone: '11955550002' },
      });
      expect(gravado?.fullName).toBe('Maria Nome Digitado');
      expect(gravado?.birthDate?.toISOString().slice(0, 10)).toBe('1992-04-05');
    });

    it('should never write a placeholder name', async () => {
      /**
       * Trava a regressão na origem: nenhum caminho pode gravar
       * "Cliente WhatsApp". Se alguém reintroduzir o placeholder, este
       * teste quebra em vez do bug voltar silenciosamente.
       */
      const res = await request(app)
        .post('/booking/create')
        .send({
          serviceId,
          employeeId,
          startsAt,
          client: {
            phone: '11955550003',
            fullName: '  Nome Com Espacos  ',
            birthDate: '1992-04-05',
          },
        })
        .expect(201);

      expect(res.body.client.fullName).toBe('Nome Com Espacos');

      const todos = await prisma.client.findMany({ select: { fullName: true } });
      expect(todos.map((c) => c.fullName)).not.toContain('Cliente WhatsApp');
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

      // Login cliente: pede o código e usa o que a API devolveu. Fora de
      // produção o código é aleatório — fixar '123456' fazia o verify
      // devolver 401 e o token virava undefined, derrubando os três testes
      // abaixo por um motivo que não tinha nada a ver com o agendamento.
      const codeRes = await request(app)
        .post('/auth/client/request-code')
        .send({ phone: '11955554444' })
        .expect(200);

      const verifyRes = await request(app)
        .post('/auth/client/verify-code')
        .send({ phone: '11955554444', code: codeRes.body.code })
        .expect(200);
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

      expect(res.body.code).toBe('APPOINTMENT_NOT_CANCELLABLE');
      expect(res.body.error).toContain('Apenas agendamentos agendados');
    });
  });
});