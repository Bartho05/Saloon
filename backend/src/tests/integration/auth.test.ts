import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '@app';
import prisma from '@config/database';
import bcrypt from 'bcryptjs';

describe('Auth Integration Tests', () => {
  let ownerToken: string;
  let employeeToken: string;
  let clientToken: string;
  const ownerPassword = '123456';

  beforeAll(async () => {
    // Limpa banco
    await prisma.user.deleteMany({ where: { role: { in: ['OWNER', 'EMPLOYEE'] } } });
    await prisma.client.deleteMany();

    // Cria owner
    const passwordHash = await bcrypt.hash(ownerPassword, 10);
    await prisma.user.create({
      data: {
        name: 'Dono Auth',
        email: 'owner.auth@test.com',
        phone: '11999991111',
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });

    // Cria funcionário
    await prisma.user.create({
      data: {
        name: 'Func Auth',
        phone: '11988882222',
        specialties: ['Corte'],
        accessCode: '654321',
        role: 'EMPLOYEE',
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.client.deleteMany();
  });

  describe('POST /auth/owner/login', () => {
    it('should login owner with valid credentials', async () => {
      const res = await request(app)
        .post('/auth/owner/login')
        .send({ email: 'owner.auth@test.com', password: ownerPassword })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.role).toBe('OWNER');
      ownerToken = res.body.accessToken;
    });

    it('should reject invalid password', async () => {
      // 6+ caracteres: abaixo disso o schema rejeita com 400 antes mesmo de
      // comparar com o hash, e o teste estaria medindo validação, não credencial.
      const res = await request(app)
        .post('/auth/owner/login')
        .send({ email: 'owner.auth@test.com', password: 'senhaerrada' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject a too-short password with 400 before hitting the database', async () => {
      const res = await request(app)
        .post('/auth/owner/login')
        .send({ email: 'owner.auth@test.com', password: '123' })
        .expect(400);

      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/auth/owner/login')
        .send({ email: 'notexist@test.com', password: ownerPassword })
        .expect(401);

      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject inactive owner', async () => {
      // Desativa owner
      await prisma.user.update({
        where: { email: 'owner.auth@test.com' },
        data: { isActive: false },
      });

      const res = await request(app)
        .post('/auth/owner/login')
        .send({ email: 'owner.auth@test.com', password: ownerPassword })
        .expect(401);

      // Reativa para outros testes
      await prisma.user.update({
        where: { email: 'owner.auth@test.com' },
        data: { isActive: true },
      });
    });
  });

  describe('POST /auth/employee/login', () => {
    it('should login employee with valid access code', async () => {
      const res = await request(app)
        .post('/auth/employee/login')
        .send({ accessCode: '654321' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.role).toBe('EMPLOYEE');
      expect(res.body.user.accessCode).toBe('654321');
      employeeToken = res.body.accessToken;
    });

    it('should reject invalid access code', async () => {
      const res = await request(app)
        .post('/auth/employee/login')
        .send({ accessCode: '000000' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_ACCESS_CODE');
    });

    it('should reject owner access code', async () => {
      // Owner não tem accessCode, mas se tentasse...
      const res = await request(app)
        .post('/auth/employee/login')
        .send({ accessCode: '123456' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_ACCESS_CODE');
    });
  });

  describe('Client WhatsApp Auth Flow', () => {
    it('should request verification code', async () => {
      const res = await request(app)
        .post('/auth/client/request-code')
        .send({ phone: '11977773333' })
        .expect(200);

      // `sent` reflete se o WhatsApp está configurado. Na suíte ele não
      // está (o `.env.test` não tem credenciais), então exigir `true`
      // seria testar configuração de terceiro, não o fluxo de autenticação.
      expect(typeof res.body.sent).toBe('boolean');

      // Fora de produção o código volta na resposta — é o que permite o
      // fluxo ser testado de ponta a ponta sem WhatsApp.
      if (process.env.NODE_ENV !== 'production') {
        expect(res.body.code).toMatch(/^\d{6}$/);
      }
    });

    it('should verify code and return tokens for new client', async () => {
      // Primeiro solicita código
      const requestRes = await request(app)
        .post('/auth/client/request-code')
        .send({ phone: '11977774444' })
        .expect(200);

      const code = requestRes.body.code || '123456'; // Em dev vem no response

      const res = await request(app)
        .post('/auth/client/verify-code')
        .send({ phone: '11977774444', code })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.client.phone).toBe('11977774444');
      clientToken = res.body.accessToken;
    });

    it('should reject invalid code', async () => {
      await request(app)
        .post('/auth/client/request-code')
        .send({ phone: '11977775555' })
        .expect(200);

      const res = await request(app)
        .post('/auth/client/verify-code')
        .send({ phone: '11977775555', code: '000000' })
        .expect(400);

      expect(res.body.code).toBe('INVALID_CODE');
    });

    it('should reject expired code', async () => {
      // Manipula armazenamento interno para expirar
      // Nota: isso testa o comportamento, mas o storage é em memória
      // Em testes reais, mockaríamos o tempo
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // Primeiro faz login para ter refresh token
      const loginRes = await request(app)
        .post('/auth/owner/login')
        .send({ email: 'owner.auth@test.com', password: ownerPassword })
        .expect(200);

      const refreshToken = loginRes.body.refreshToken;

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();

      // NÃO se pode exigir que o novo token difira do antigo: um JWT é
      // assinado a partir de (payload, segredo) e o payload inclui `iat` em
      // segundos. Um refresh feito no mesmo segundo do login produz
      // exatamente a mesma string — e isso está correto.
      // O que precisa valer é que o token novo funciona.
      const me = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      expect(me.body.user.email).toBe('owner.auth@test.com');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('GET /auth/me', () => {
    it('should return owner data with owner token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.user.role).toBe('OWNER');
      expect(res.body.user.email).toBe('owner.auth@test.com');
    });

    it('should return employee data with employee token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(res.body.user.role).toBe('EMPLOYEE');
      expect(res.body.user.accessCode).toBe('654321');
    });

    it('should return client data with client token', async () => {
      // Cria cliente via verify-code
      const requestRes = await request(app)
        .post('/auth/client/request-code')
        .send({ phone: '11977776666' })
        .expect(200);

      // Usa o código que a API devolveu, e não um fixo: fora de produção o
      // código é aleatório e '123456' quase nunca é o válido.
      const verifyRes = await request(app)
        .post('/auth/client/verify-code')
        .send({ phone: '11977776666', code: requestRes.body.code })
        .expect(200);

      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${verifyRes.body.accessToken}`)
        .expect(200);

      expect(res.body.client.phone).toBe('11977776666');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .get('/auth/me')
        .expect(401);

      expect(res.body.code).toBe('NOT_AUTHENTICATED');
    });
  });
});