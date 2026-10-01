import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '@app';
import prisma from '@config/database';
import { AuditAction } from '@services/auditService';
import * as codigos from '@services/verificationCodeService';

/**
 * Testes da trilha de auditoria e dos códigos de verificação.
 *
 * O foco não é "a função grava no banco" — isso é o Prisma fazendo o trabalho
 * dele. O foco são as três garantias que o resto do sistema depende:
 *
 * 1. A trilha sobrevive à conta (sem chave estrangeira), para o rastro não
 *    sumir junto com quem o produziu.
 * 2. A trilha nunca guarda segredo. Se um dia alguém passar o token do
 *    WhatsApp no `metadata`, o teste quebra.
 * 3. O código de verificação é de uso único e expira. Sem isso, interceptar o
 *    código de outra pessoa e entrar na conta dela seria trivial.
 */

describe('Auditoria', () => {
  /**
   * Dono próprio deste arquivo, recriado em CADA teste.
   *
   * A primeira versão usava `upsert` num `beforeAll`, e isso falhava de forma
   * intermitente na suíte completa: `booking.test.ts` faz
   * `deleteMany({ role: 'OWNER' })`, então a conta podia não existir — ou
   * existir com o hash de uma execução anterior — no momento do login. O
   * sintoma era "Email ou senha inválidos" num teste cujo dono estava
   * visivelmente correto.
   *
   * Recriar antes de cada teste remove a dependência do que rodou antes. O hash
   * é caro (bcrypt), então é calculado uma vez e reaproveitado: só o registro
   * é refeito, que é o que importa.
   */
  const DONO = {
    name: 'Dono Auditoria',
    email: 'owner.auditoria@test.com',
    phone: '31977770001',
    password: 'senha-auditoria-1',
  };

  let passwordHash: string;

  beforeAll(async () => {
    const bcrypt = await import('bcryptjs');
    passwordHash = await bcrypt.default.hash(DONO.password, 10);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: DONO.email } });
    // Campos nomeados, e não `...DONO`: o objeto guarda a senha em texto para
    // o login, e ela não é coluna — o banco só conhece o hash.
    await prisma.user.create({
      data: {
        name: DONO.name,
        email: DONO.email,
        phone: DONO.phone,
        passwordHash,
        role: 'OWNER',
        isActive: true,
      },
    });

    await prisma.auditLog.deleteMany({});
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: DONO.email } });
  });

  async function tokenDeDono(): Promise<string> {
    const login = await request(app)
      .post('/auth/owner/login')
      .send({ email: DONO.email, password: DONO.password });

    return login.body.accessToken;
  }

  describe('o que entra', () => {
    it('registra o login do dono com quem agiu', async () => {
      await request(app)
        .post('/auth/owner/login')
        .send({ email: DONO.email, password: DONO.password })
        .expect(200);

      const entrada = await prisma.auditLog.findFirst({
        where: { action: AuditAction.LOGIN },
      });

      expect(entrada).not.toBeNull();
      expect(entrada!.actorKind).toBe('OWNER');
      expect(entrada!.outcome).toBe('SUCCESS');
      // A frase é a parte que a tela mostra, então precisa estar em português
      // legível e não ser o código da ação.
      expect(entrada!.summary).toContain('Entrou');
    });

    it('registra a tentativa falha de login, com resultado FAILURE', async () => {
      await request(app)
        .post('/auth/owner/login')
        .send({ email: DONO.email, password: 'senha-errada-123' })
        .expect(401);

      const entrada = await prisma.auditLog.findFirst({
        where: { action: AuditAction.LOGIN_FAILED },
      });

      expect(entrada).not.toBeNull();
      expect(entrada!.outcome).toBe('FAILURE');
    });

    it('registra criação de serviço com o preço, para responder "a quanto vendi?"', async () => {
      const token = await tokenDeDono();

      const res = await request(app)
        .post('/owner/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Corte TESTE', durationMinutes: 30, price: 45 })
        .expect(201);

      const entrada = await prisma.auditLog.findFirst({
        where: { action: AuditAction.SERVICE_CREATED, entityId: res.body.service.id },
      });

      expect(entrada).not.toBeNull();
      expect(entrada!.actorKind).toBe('OWNER');
      // O preço na hora da criação é o que permite reconstituir a tabela de
      // preços depois que ela mudou.
      expect(entrada!.metadata).toMatchObject({ preco: 45, duracao: 30 });

      await prisma.service.deleteMany({ where: { id: res.body.service.id } });
    });

    it('registra a alteração com o antes e o depois do preço', async () => {
      const token = await tokenDeDono();

      const criado = await request(app)
        .post('/owner/services')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Corte ALTERACAO', durationMinutes: 30, price: 40 })
        .expect(201);

      const id = criado.body.service.id;

      await request(app)
        .patch(`/owner/services/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 55 })
        .expect(200);

      const entrada = await prisma.auditLog.findFirst({
        where: { action: AuditAction.SERVICE_UPDATED, entityId: id },
      });

      expect(entrada).not.toBeNull();
      // Sem o "de", o log só diria "o preço mudou" — e a pergunta que aparece
      // um mês depois é sempre qual era o preço antes.
      expect(entrada!.metadata).toMatchObject({
        alteracoes: { price: { de: 40, para: 55 } },
      });

      await prisma.service.deleteMany({ where: { id } });
    });
  });

  describe('o que nunca entra', () => {
    it('não guarda a senha nem o hash dela', async () => {
      await request(app)
        .post('/auth/owner/login')
        .send({ email: DONO.email, password: DONO.password })
        .expect(200);

      const dump = JSON.stringify(
        await prisma.auditLog.findMany({ where: { entity: 'auth' } })
      );

      expect(dump).not.toContain(DONO.password);
      // `$2b$` é o prefixo do bcrypt. Se aparecer, alguém passou o hash para
      // dentro do metadata.
      expect(dump).not.toContain('$2b$');
      expect(dump).not.toContain('$2a$');
      expect(dump).not.toContain('$2y$');
    });

    it('não guarda o token do WhatsApp ao reconfigurar', async () => {
      const token = await tokenDeDono();
      const segredo = 'token-super-secreto-que-nao-pode-aparecer';

      await request(app)
        .patch('/owner/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          whatsappApiConfig: {
            provider: 'zapi',
            instanceId: 'inst-teste',
            token: segredo,
            apiUrl: 'https://api.z-api.io',
          },
        })
        .expect(200);

      const dump = JSON.stringify(await prisma.auditLog.findMany({ where: { entity: 'whatsapp' } }));

      expect(dump).not.toContain(segredo);
      // Mas registra que mudou, e que há token.
      expect(dump).toContain('inst-teste');
    });
  });

  describe('a trilha sobrevive à conta', () => {
    /**
     * Este teste existe porque a decisão de não usar chave estrangeira parece
     * descuidada se ninguém conferir o efeito.
     *
     * O cenário: alguém com acesso ao banco apaga a própria conta e sai. Com
     * FK e `ON DELETE CASCADE` — o padrão que um modelador escolheria sem
     * pensar — o rastro da invasão desapareceria junto com o invasor. É
     * exatamente o registro que interessa preservar.
     */
    it('os registros não têm FK para o autor e continuam após a conta sumir', async () => {
      const bcrypt = await import('bcryptjs');
      const passwordHash = await bcrypt.default.hash('senha123', 10);
      const email = `efemera.${Date.now()}@teste.com`;
      const phone = `3190000${String(Date.now()).slice(-4)}`;

      const usuario = await prisma.user.create({
        data: { name: 'Efêmero', email, phone, passwordHash, role: 'OWNER', isActive: true },
      });

      await request(app)
        .post('/auth/owner/login')
        .send({ email, password: 'senha123' })
        .expect(200);

      const antes = await prisma.auditLog.count({ where: { actorId: usuario.id } });
      expect(antes).toBeGreaterThan(0);

      await prisma.user.delete({ where: { id: usuario.id } });

      // O log continua lá, com o id do autor que não existe mais.
      const depois = await prisma.auditLog.count({ where: { actorId: usuario.id } });
      expect(depois).toBe(antes);
    });
  });

  describe('a consulta', () => {
    /**
     * Os filtros são testados pelo serviço, não pela rota.
     *
     * A rota exige token de superadmin, e o que está em jogo aqui é a lógica do
     * filtro — "traz só falhas", "busca no texto", "respeita o teto". A
     * autorização da rota tem suíte própria, em `superadmin.test.ts`.
     */
    it('filtra por resultado, por área e por texto', async () => {
      const { list } = await import('@services/auditService');

      await prisma.auditLog.createMany({
        data: [
          {
            action: AuditAction.APPOINTMENT_CREATED,
            entity: 'appointment',
            actorKind: 'CLIENT',
            summary: 'Agendou Corte com Carlos',
            outcome: 'SUCCESS',
          },
          {
            action: AuditAction.APPOINTMENT_REJECTED,
            entity: 'appointment',
            actorKind: 'CLIENT',
            summary: 'Agendamento recusado: horário indisponível',
            outcome: 'FAILURE',
          },
        ],
      });

      const falhas = await list({ outcome: 'FAILURE' });
      expect(falhas.entries.length).toBeGreaterThan(0);
      expect(falhas.entries.every((e) => e.outcome === 'FAILURE')).toBe(true);

      const agendamentos = await list({ entity: 'appointment' });
      expect(agendamentos.entries.length).toBeGreaterThanOrEqual(2);

      // Busca por texto: é como a pessoa procura "indisponível" sem saber qual
      // ação gerou a linha.
      const busca = await list({ busca: 'indisponível' });
      expect(busca.entries.length).toBe(1);
      expect(busca.entries[0].action).toBe(AuditAction.APPOINTMENT_REJECTED);
    });

    it('o teto de 500 registros protege de uma consulta que derruba o processo', async () => {
      const { list } = await import('@services/auditService');
      const res = await list({ limit: 100_000 });
      expect(res.limit).toBe(500);
    });
  });
});

describe('Código de verificação do cliente', () => {
  const TELEFONE = '31999998888';

  beforeEach(async () => {
    await prisma.verificationCode.deleteMany({ where: { phone: TELEFONE } });
  });

  afterAll(async () => {
    await prisma.verificationCode.deleteMany({ where: { phone: TELEFONE } });
    // Sem `$disconnect()` aqui de propósito: o Prisma é uma instância
    // compartilhada, e desconectar no meio do arquivo derruba as consultas dos
    // testes seguintes. Quem fecha é o `afterAll` do `setup.ts`.
  });

  it('aceita o código certo', async () => {
    await codigos.guarda(TELEFONE, '123456');
    const r = await codigos.verifica(TELEFONE, '123456');
    expect(r).toEqual({ ok: true });
  });

  it('recusa o código errado', async () => {
    await codigos.guarda(TELEFONE, '123456');
    const r = await codigos.verifica(TELEFONE, '654321');
    expect(r).toEqual({ ok: false, motivo: 'ERRADO' });
  });

  /**
   * Uso único é a propriedade mais importante do código.
   *
   * Sem isto, quem visse o código no WhatsApp de outra pessoa poderia usar o
   * mesmo código à vontade, e a janela de 10 minutos viraria "use quantas vezes
   * quiser". Verificar duas vezes seguidas tem que falhar.
   */
  it('é de uso único: o mesmo código não funciona duas vezes', async () => {
    await codigos.guarda(TELEFONE, '123456');

    expect(await codigos.verifica(TELEFONE, '123456')).toEqual({ ok: true });
    expect(await codigos.verifica(TELEFONE, '123456')).toEqual({
      ok: false,
      motivo: 'NAO_PEDIDO',
    });
  });

  it('expira em 10 minutos', async () => {
    await codigos.guarda(TELEFONE, '123456');

    // Empurra a validade para o passado, em vez de esperar 10 minutos.
    await prisma.verificationCode.updateMany({
      where: { phone: TELEFONE },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const r = await codigos.verifica(TELEFONE, '123456');
    expect(r).toEqual({ ok: false, motivo: 'EXPIRADO' });
  });

  /**
   * Pedir um código novo invalida o antigo.
   *
   * Sem isto, existiram dois códigos válidos ao mesmo tempo, e o segundo pedido
   * — que o cliente fez porque o primeiro "não chegou" — não protegeria nada: o
   * primeiro continuaria valendo.
   *
   * O motivo devolvido é `ERRADO`, e não `NAO_PEDIDO`, porque existe um código
   * pendente — só não é este. A distinção aparece no log, que é interno: o
   * cliente recebe "Código inválido" nos dois casos, e confirmar qual é qual
   * revelaria que aquele telefone tem uma solicitação em aberto.
   */
  it('pedir de novo invalida o código anterior', async () => {
    await codigos.guarda(TELEFONE, '111111');
    await codigos.guarda(TELEFONE, '222222');

    const antigo = await codigos.verifica(TELEFONE, '111111');
    expect(antigo).toEqual({ ok: false, motivo: 'ERRADO' });

    // E o novo, que é o único válido, funciona.
    expect(await codigos.verifica(TELEFONE, '222222')).toEqual({ ok: true });
  });

  it('bloqueia depois de cinco tentativas erradas', async () => {
    await codigos.guarda(TELEFONE, '123456');

    for (let i = 0; i < codigos.MAX_TENTATIVAS; i++) {
      const r = await codigos.verifica(TELEFONE, '000000');
      expect(r.ok).toBe(false);
    }

    // O código CERTO também não entra mais. Sem isto, o contador de tentativas
    // seria só um aviso, não uma trava.
    const r = await codigos.verifica(TELEFONE, '123456');
    expect(r).toEqual({ ok: false, motivo: 'NAO_PEDIDO' });
  });

  it('guarda o hash, nunca o código', async () => {
    await codigos.guarda(TELEFONE, '123456');

    const registro = await prisma.verificationCode.findFirst({ where: { phone: TELEFONE } });
    expect(registro).not.toBeNull();
    expect(registro!.codeHash).not.toBe('123456');
    expect(registro!.codeHash).toMatch(/^[0-9a-f]{64}$/);

    const dump = JSON.stringify(registro);
    expect(dump).not.toContain('123456');
  });

  it('normaliza o telefone, para o código não falhar por formatação', async () => {
    // A tela envia com máscara; o banco grava só dígitos. Se a comparação
    // fosse por string crua, o cliente receberia um código que o sistema
    // "não conhece" — e o motivo pareceria ser o WhatsApp.
    await codigos.guarda('(31) 99999-8888', '123456');
    const r = await codigos.verifica('31999998888', '123456');
    expect(r).toEqual({ ok: true });
  });
});
