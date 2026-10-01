import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '@app';
import prisma from '@config/database';
import { env } from '@config/env';
import { generateAccessCode, hashCode } from '@services/superadminCrypto';

/**
 * A semente vem do `env` de verdade, e não de uma constante aqui.
 *
 * `env` é lido uma vez na importação e congelado; trocar `process.env` no
 * teste não muda nada, e o serviço compara com o valor já capturado. Um teste
 * que definisse a própria semente estaria exercitando o valor errado.
 */
const SEED = env.SUPERADMIN_BOOTSTRAP_SEED;

describe('Superadmin — acesso de nível máximo', () => {
  const email = 'super@teste.com';
  let codigo: string;
  let token: string;

  beforeEach(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.superAdmin.deleteMany({});

    codigo = generateAccessCode();
    const { hash, salt, fingerprint } = await hashCode(codigo);
    await prisma.superAdmin.create({
      data: {
        name: 'Super Teste',
        email,
        codeHash: hash,
        codeSalt: salt,
        codeFingerprint: fingerprint,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({});
    await prisma.superAdmin.deleteMany({});
    await prisma.$disconnect();
  });

  describe('bootstrap', () => {
    it('recusa sem a semente correta', async () => {
      await prisma.superAdmin.deleteMany({});
      const res = await request(app)
        .post('/superadmin/bootstrap')
        .send({ name: 'Novo', email: 'novo@teste.com', seed: 'errada' })
        .expect(401);

      expect(res.body.code).toBe('INVALID_SEED');
      expect(await prisma.superAdmin.count()).toBe(0);
      // A tentativa fica registrada, mesmo sem conta correspondente.
      const registrada = await prisma.auditLog.findFirst({
        where: { action: 'SUPERADMIN_BOOTSTRAP_DENIED' },
      });
      expect(registrada).not.toBeNull();
      expect(registrada!.outcome).toBe('FAILURE');
      expect(registrada!.actorKind).toBe('SUPERADMIN');
      expect(registrada!.entity).toBe('superadmin');
    });

    it('cria o primeiro e devolve o código uma única vez', async () => {
      await prisma.superAdmin.deleteMany({});
      expect(SEED, 'o .env.test precisa ter SUPERADMIN_BOOTSTRAP_SEED').toBeTruthy();

      const res = await request(app)
        .post('/superadmin/bootstrap')
        .send({ name: 'Primeiro', email: 'primeiro@teste.com', seed: SEED })
        .expect(201);

      expect(res.body.accessCode).toHaveLength(24);
      expect(res.body.superAdmin.email).toBe('primeiro@teste.com');
      // Nenhum campo de segredo na resposta, além do código em si.
      expect(res.body.superAdmin.codeHash).toBeUndefined();
      expect(res.body.superAdmin.codeSalt).toBeUndefined();
    });

    it('fecha a porta depois que existe uma conta', async () => {
      const res = await request(app)
        .post('/superadmin/bootstrap')
        .send({ name: 'Intruso', email: 'intruso@teste.com', seed: SEED })
        .expect(409);

      expect(res.body.code).toBe('ALREADY_BOOTSTRAPPED');
    });

    it('responde se ainda não existe superadmin', async () => {
      await prisma.superAdmin.deleteMany({});
      const res = await request(app).get('/superadmin/bootstrap-status').expect(200);
      expect(res.body.hasSuperAdmin).toBe(false);
    });
  });

  describe('login por código', () => {
    it('aceita o código certo', async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(200);

      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.superAdmin.email).toBe(email);
      token = res.body.accessToken;
    });

    it('recusa o código errado', async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .send({ email, code: generateAccessCode() })
        .expect(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    /**
     * Resposta idêntica para e-mail inexistente e para código errado. Se
     * divergissem, a diferença revelaria quais e-mails têm conta.
     */
    it('não revela se o e-mail existe', async () => {
      const inexistente = await request(app)
        .post('/superadmin/login')
        .send({ email: 'ninguem@teste.com', code: generateAccessCode() })
        .expect(401);

      const codigoErrado = await request(app)
        .post('/superadmin/login')
        .send({ email, code: generateAccessCode() })
        .expect(401);

      expect(inexistente.body.error).toBe(codigoErrado.body.error);
      expect(inexistente.body.code).toBe(codigoErrado.body.code);
    });

    it('aceita o código colado com espaços e em minúsculas', async () => {
      const colado = codigo.replace(/(.{4})/g, '$1 ').toLowerCase();
      await request(app)
        .post('/superadmin/login')
        .send({ email, code: colado })
        .expect(200);
    });

    it('devolve tokens, nunca o código', async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(codigo);
    });

    it('trava a conta após tentativas repetidas', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/superadmin/login')
          .send({ email, code: generateAccessCode() })
          .expect(401);
      }

      // Quarta tentativa: a conta já está travada, e a mensagem diz por quê.
      const res = await request(app)
        .post('/superadmin/login')
        .send({ email, code: generateAccessCode() })
        .expect(429);

      expect(res.body.code).toBe('ACCOUNT_LOCKED');

      // E mesmo o código CERTO não entra enquanto travada.
      await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(429);
    });
  });

  describe('proteção das rotas', () => {
    beforeEach(async () => {
      const res = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo });
      token = res.body.accessToken;
    });

    it('exige token', async () => {
      await request(app).get('/superadmin/overview').expect(401);
    });

    it('recusa token de dono', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash('senha123', 10);
      const dono = await prisma.user.create({
        data: {
          name: 'Dono Qualquer',
          email: `dono.${Date.now()}@teste.com`,
          phone: `31${String(Date.now()).slice(-8)}`,
          passwordHash,
          role: 'OWNER',
        },
      });

      const login = await request(app)
        .post('/auth/owner/login')
        .send({ email: dono.email, password: 'senha123' })
        .expect(200);

      await request(app)
        .get('/superadmin/overview')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(403);
    });

    it('devolve o estado da instalação', async () => {
      const res = await request(app)
        .get('/superadmin/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toHaveProperty('counts');
      expect(res.body.status).toHaveProperty('steps');
      expect(Array.isArray(res.body.status.steps)).toBe(true);
    });

    it('o overview não vaza segredo', async () => {
      const res = await request(app)
        .get('/superadmin/overview')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain(codigo);
    });

    it('a lista de contas não traz hash nem salt', async () => {
      const res = await request(app)
        .get('/superadmin/accounts')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const admin = res.body.superAdmins[0];
      expect(admin.codeFingerprint).toMatch(/^[0-9a-f]{6}$/);
      expect(admin.codeHash).toBeUndefined();
      expect(admin.codeSalt).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain(codigo);
    });
  });

  describe('rotação de código', () => {
    it('o código novo funciona e o antigo morre', async () => {
      const login = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(200);
      const tokenRot = login.body.accessToken;

      const antes = await prisma.superAdmin.findUnique({ where: { email } });
      const rot = await request(app)
        .post('/superadmin/rotate-code')
        .set('Authorization', `Bearer ${tokenRot}`)
        .expect(200);

      expect(rot.body.accessCode).toHaveLength(24);
      expect(rot.body.accessCode).not.toBe(codigo);
      expect(rot.body.superAdmin.codeFingerprint).not.toBe(antes?.codeFingerprint);

      // O antigo é recusado.
      await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(401);

      // O novo entra.
      const novo = await request(app)
        .post('/superadmin/login')
        .send({ email, code: rot.body.accessCode })
        .expect(200);
      expect(novo.body.accessToken).toBeTruthy();
    });

    /**
     * A trava tem que ter FIM.
     *
     * Este teste existiu porque a primeira versão desta suite travava a conta
     * e depois tentava rotacionar o código para destravar — o que é impossível:
     * rotacionar exige sessão, e sessão exige entrar, e entrar exige estar
     * destravado. Um caminho sem saída. A trava é temporária de propósito: o
     * atacante espera, o superadmin legítimo também.
     */
    it('a trava expira e o código certo volta a valer', async () => {
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/superadmin/login')
          .send({ email, code: generateAccessCode() })
          .expect(401);
      }

      // Nem o código CERTO entra enquanto travada.
      const travado = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(429);
      expect(travado.body.code).toBe('ACCOUNT_LOCKED');

      const admin = await prisma.superAdmin.findUnique({ where: { email } });
      expect(admin?.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

      // Passada a janela, a conta volta sozinha. O teste adianta o relógio
      // em vez de esperar minutos.
      await prisma.superAdmin.update({
        where: { id: admin!.id },
        data: { lockedUntil: new Date(Date.now() - 1000) },
      });

      const liberado = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(200);
      expect(liberado.body.accessToken).toBeTruthy();

      // E a contagem de falhas zera no login bem-sucedido.
      const depois = await prisma.superAdmin.findUnique({ where: { id: admin!.id } });
      expect(depois?.failedAttempts).toBe(0);
    });
  });

  describe('primeiro proprietário', () => {
    beforeEach(async () => {
      const login = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo });
      token = login.body.accessToken;
    });

    it('cria o dono com a senha em hash', async () => {
      const phone = `31${String(Date.now()).slice(-8)}`;
      const emailDono = `dono.${Date.now()}@teste.com`;

      const res = await request(app)
        .post('/superadmin/owners')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dono Novo', email: emailDono, phone, password: 'senha123' })
        .expect(201);

      expect(res.body.owner.name).toBe('Dono Novo');
      // A senha não volta na resposta.
      expect(JSON.stringify(res.body)).not.toContain('senha123');

      const dono = await prisma.user.findUnique({ where: { phone } });
      expect(dono?.role).toBe('OWNER');
      expect(dono?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(dono?.passwordHash).not.toBe('senha123');

      // E ele consegue entrar.
      const login = await request(app)
        .post('/auth/owner/login')
        .send({ email: emailDono, password: 'senha123' })
        .expect(200);
      expect(login.body.accessToken).toBeTruthy();

      // O login registrou o acesso.
      await prisma.user.deleteMany({ where: { phone } });
    });

    it('recusa e-mail ou telefone já usado', async () => {
      const phone = `31${String(Date.now() + 1).slice(-8)}`;
      const emailDono = `dono.${Date.now()}@teste.com`;

      await request(app)
        .post('/superadmin/owners')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Primeiro', email: emailDono, phone, password: 'senha123' })
        .expect(201);

      await request(app)
        .post('/superadmin/owners')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Segundo', email: emailDono, phone: `31${String(Date.now() + 2).slice(-8)}`, password: 'senha123' })
        .expect(409);

      await prisma.user.deleteMany({ where: { phone } });
    });

    it('exige senha de 6 caracteres', async () => {
      await request(app)
        .post('/superadmin/owners')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Curto',
          email: `curto.${Date.now()}@teste.com`,
          phone: `31${String(Date.now()).slice(-8)}`,
          password: '123',
        })
        .expect(400);
    });
  });

  describe('desativação', () => {
    it('derruba o acesso na hora, sem esperar o token expirar', async () => {
      const login = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo });
      const t = login.body.accessToken;

      // Token válido no instante da desativação.
      await request(app).get('/superadmin/overview').set('Authorization', `Bearer ${t}`).expect(200);

      const admin = await prisma.superAdmin.findUnique({ where: { email } });
      await request(app)
        .patch(`/superadmin/${admin!.id}/active`)
        .set('Authorization', `Bearer ${t}`)
        .send({ isActive: false })
        .expect(200);

      // Mesmo token, agora recusado. É a diferença entre revogar em 15 minutos
      // e revogar agora.
      await request(app)
        .get('/superadmin/overview')
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });
  });

  describe('auditoria', () => {
    it('registra entradas, falhas e criação de dono, sem guardar segredos', async () => {
      const login = await request(app)
        .post('/superadmin/login')
        .send({ email, code: codigo })
        .expect(200);
      const t = login.body.accessToken;

      await request(app)
        .post('/superadmin/login')
        .send({ email, code: generateAccessCode() })
        .expect(401);

      const phone = `31${String(Date.now()).slice(-8)}`;
      await request(app)
        .post('/superadmin/owners')
        .set('Authorization', `Bearer ${t}`)
        .send({
          name: 'Dono Auditado',
          email: `aud.${Date.now()}@teste.com`,
          phone,
          password: 'senha123',
        })
        .expect(201);

      const res = await request(app)
        .get('/superadmin/audit')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      const acoes = res.body.entries.map((e: { action: string }) => e.action);
      expect(acoes).toContain('LOGIN');
      expect(acoes).toContain('LOGIN_FAILED');
      expect(acoes).toContain('OWNER_CREATED');

      // A trilha é da instalação inteira, não só do superadmin: quem entrou é
      // identificado pelo tipo, e não por uma tabela separada.
      expect(res.body.entries.every((e: { actorKind: string }) => e.actorKind === 'SUPERADMIN')).toBe(
        true
      );

      // A entrada traz a frase pronta para a tela, não um código para traduzir.
      const entrada = res.body.entries.find((e: { action: string }) => e.action === 'OWNER_CREATED');
      expect(entrada.summary).toContain('Dono Auditado');

      // Nem o código nem a senha entram na trilha.
      const dump = JSON.stringify(res.body);
      expect(dump).not.toContain(codigo);
      expect(dump).not.toContain('senha123');

      await prisma.user.deleteMany({ where: { phone } });
    });
  });
});
