import { describe, it, expect } from 'vitest';
import {
  phoneSchema,
  ownerLoginSchema,
  employeeLoginSchema,
  clientRequestCodeSchema,
  clientVerifyCodeSchema,
  createServiceSchema,
  updateServiceSchema,
  createEmployeeSchema,
  updateEmployeeSchema,
  checkClientSchema,
  getSlotsSchema,
  createBookingSchema,
  cancelBookingSchema,
  updateAppointmentStatusSchema,
  listAppointmentsSchema,
  updateSettingsSchema,
  financialQuerySchema,
  uuidParamSchema,
} from '@utils/validation';

/**
 * Os schemas validam o objeto DIRETO — quem desembrulha `req.body`,
 * `req.query` e `req.params` são os middlewares `validateBody`,
 * `validateQuery` e `validateParams`.
 *
 * A versão anterior desta suíte passava `{ body: {...}, params: {...} }`
 * (formato Express cru) e por isso falhava em 15 casos: não era a
 * aplicação que estava quebrada, era o teste descrevendo um contrato que
 * não existe mais.
 */
const UUID_A = '123e4567-e89b-12d3-a456-426614174000';
const UUID_B = '123e4567-e89b-12d3-a456-426614174001';

describe('Validation Schemas', () => {
  describe('phoneSchema', () => {
    it('should accept valid 11-digit mobile phones', () => {
      expect(phoneSchema.parse('11999999999')).toBe('11999999999');
      expect(phoneSchema.parse('21988887777')).toBe('21988887777');
    });

    it('should accept valid 10-digit landline phones', () => {
      expect(phoneSchema.parse('1133334444')).toBe('1133334444');
    });

    it('should reject phones with less than 10 digits', () => {
      expect(() => phoneSchema.parse('119999999')).toThrow();
    });

    it('should reject phones with more than 11 digits', () => {
      expect(() => phoneSchema.parse('119999999999')).toThrow();
    });

    it('should reject non-numeric phones', () => {
      expect(() => phoneSchema.parse('1199999-9999')).toThrow();
      expect(() => phoneSchema.parse('(11) 99999-9999')).toThrow();
    });

    it('should reject invalid DDD', () => {
      expect(() => phoneSchema.parse('0999999999')).toThrow(); // DDD 09 inválido
      expect(() => phoneSchema.parse('1099999999')).toThrow(); // DDD 10 inválido
      expect(() => phoneSchema.parse('00999999999')).toThrow();
    });
  });

  describe('ownerLoginSchema', () => {
    it('should accept valid email and password', () => {
      const result = ownerLoginSchema.parse({
        email: 'owner@salao.com',
        password: '123456',
      });
      expect(result.email).toBe('owner@salao.com');
    });

    it('should reject invalid email', () => {
      expect(() =>
        ownerLoginSchema.parse({ email: 'invalid-email', password: '123456' })
      ).toThrow();
    });

    it('should reject short password', () => {
      expect(() =>
        ownerLoginSchema.parse({ email: 'owner@salao.com', password: '123' })
      ).toThrow();
    });
  });

  describe('employeeLoginSchema', () => {
    it('should accept valid 6-digit access code', () => {
      const result = employeeLoginSchema.parse({ accessCode: '123456' });
      expect(result.accessCode).toBe('123456');
    });

    it('should reject non-6-digit codes', () => {
      expect(() => employeeLoginSchema.parse({ accessCode: '12345' })).toThrow();
      expect(() => employeeLoginSchema.parse({ accessCode: '1234567' })).toThrow();
      expect(() => employeeLoginSchema.parse({ accessCode: 'abcdef' })).toThrow();
    });
  });

  describe('clientRequestCodeSchema', () => {
    it('should accept valid phone', () => {
      const result = clientRequestCodeSchema.parse({ phone: '11999999999' });
      expect(result.phone).toBe('11999999999');
    });

    it('should reject invalid phone', () => {
      expect(() => clientRequestCodeSchema.parse({ phone: '123' })).toThrow();
    });
  });

  describe('clientVerifyCodeSchema', () => {
    it('should accept valid phone and 6-digit code', () => {
      const result = clientVerifyCodeSchema.parse({
        phone: '11999999999',
        code: '123456',
      });
      expect(result.code).toBe('123456');
    });

    it('should reject invalid code length', () => {
      expect(() =>
        clientVerifyCodeSchema.parse({ phone: '11999999999', code: '12345' })
      ).toThrow();
    });
  });

  describe('createServiceSchema', () => {
    it('should accept valid service data', () => {
      const result = createServiceSchema.parse({
        name: 'Corte Feminino',
        description: 'Corte moderno',
        durationMinutes: 60,
        price: 80.0,
      });
      expect(result.name).toBe('Corte Feminino');
    });

    it('should reject short name', () => {
      expect(() =>
        createServiceSchema.parse({ name: 'C', durationMinutes: 30, price: 50 })
      ).toThrow();
    });

    it('should reject invalid duration', () => {
      expect(() =>
        createServiceSchema.parse({ name: 'Corte', durationMinutes: 10, price: 50 })
      ).toThrow(); // mínimo 15 min

      expect(() =>
        createServiceSchema.parse({ name: 'Corte', durationMinutes: 500, price: 50 })
      ).toThrow(); // máximo 480 min
    });

    it('should reject non-positive price', () => {
      expect(() =>
        createServiceSchema.parse({ name: 'Corte', durationMinutes: 30, price: 0 })
      ).toThrow();

      expect(() =>
        createServiceSchema.parse({ name: 'Corte', durationMinutes: 30, price: -10 })
      ).toThrow();
    });
  });

  describe('updateServiceSchema', () => {
    it('should accept partial updates', () => {
      const result = updateServiceSchema.parse({ name: 'Novo Nome' });
      expect(result.name).toBe('Novo Nome');
    });

    it('should accept an empty patch (no-op)', () => {
      expect(() => updateServiceSchema.parse({})).not.toThrow();
    });

    it('should reject invalid price on partial update', () => {
      expect(() => updateServiceSchema.parse({ price: 0 })).toThrow();
    });
  });

  describe('createEmployeeSchema', () => {
    it('should accept valid employee data', () => {
      const result = createEmployeeSchema.parse({
        name: 'Maria Silva',
        phone: '11999999999',
        specialties: ['Corte', 'Escova'],
        serviceIds: [UUID_A],
      });
      expect(result.name).toBe('Maria Silva');
    });

    it('should require at least one specialty', () => {
      expect(() =>
        createEmployeeSchema.parse({
          name: 'Maria',
          phone: '11999999999',
          specialties: [],
          serviceIds: [UUID_A],
        })
      ).toThrow();
    });

    it('should reject non-uuid serviceIds', () => {
      expect(() =>
        createEmployeeSchema.parse({
          name: 'Maria',
          phone: '11999999999',
          specialties: ['Corte'],
          serviceIds: ['nao-e-uuid'],
        })
      ).toThrow();
    });
  });

  describe('updateEmployeeSchema', () => {
    it('should accept partial updates', () => {
      const result = updateEmployeeSchema.parse({ isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should allow an empty specialty list on update', () => {
      // No update a lista pode ser esvaziada, o que no create não pode.
      const result = updateEmployeeSchema.parse({ specialties: [] });
      expect(result.specialties).toEqual([]);
    });
  });

  describe('checkClientSchema', () => {
    it('should accept valid phone', () => {
      expect(checkClientSchema.parse({ phone: '31955554444' }).phone).toBe('31955554444');
    });

    it('should reject invalid phone', () => {
      expect(() => checkClientSchema.parse({ phone: 'abc' })).toThrow();
    });
  });

  describe('getSlotsSchema', () => {
    it('should accept valid params', () => {
      const result = getSlotsSchema.parse({
        employeeId: UUID_A,
        serviceId: UUID_B,
        date: '2025-01-15',
      });
      expect(result.date).toBe('2025-01-15');
    });

    it('should reject invalid date format', () => {
      expect(() =>
        getSlotsSchema.parse({
          employeeId: UUID_A,
          serviceId: UUID_B,
          date: '15/01/2025',
        })
      ).toThrow();
    });

    it('should reject non-uuid employeeId', () => {
      expect(() =>
        getSlotsSchema.parse({ employeeId: 'abc', serviceId: UUID_B, date: '2025-01-15' })
      ).toThrow();
    });
  });

  describe('createBookingSchema', () => {
    it('should accept complete booking data for new client', () => {
      const result = createBookingSchema.parse({
        serviceId: UUID_A,
        employeeId: UUID_B,
        startsAt: '2025-01-15T10:00:00-03:00',
        client: {
          phone: '11999999999',
          fullName: 'João Silva',
          birthDate: '1990-05-15',
        },
      });
      expect(result.client.fullName).toBe('João Silva');
    });

    it('should accept booking for existing client (only phone)', () => {
      const result = createBookingSchema.parse({
        serviceId: UUID_A,
        employeeId: UUID_B,
        startsAt: '2025-01-15T10:00:00-03:00',
        client: { phone: '11999999999' },
      });
      expect(result.client.phone).toBe('11999999999');
      expect(result.client.fullName).toBeUndefined();
    });

    it('should reject invalid ISO datetime', () => {
      expect(() =>
        createBookingSchema.parse({
          serviceId: UUID_A,
          employeeId: UUID_B,
          startsAt: '2025-01-15 10:00:00', // sem timezone
          client: { phone: '11999999999' },
        })
      ).toThrow();
    });
  });

  describe('cancelBookingSchema', () => {
    it('should accept an empty cancellation', () => {
      expect(() => cancelBookingSchema.parse({})).not.toThrow();
    });

    it('should reject a reason longer than 200 chars', () => {
      expect(() => cancelBookingSchema.parse({ reason: 'x'.repeat(201) })).toThrow();
    });
  });

  describe('updateAppointmentStatusSchema', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
      for (const status of validStatuses) {
        const result = updateAppointmentStatusSchema.parse({ status });
        expect(result.status).toBe(status);
      }
    });

    it('should reject invalid status', () => {
      expect(() => updateAppointmentStatusSchema.parse({ status: 'INVALID' })).toThrow();
    });
  });

  describe('listAppointmentsSchema', () => {
    it('should apply pagination defaults', () => {
      const result = listAppointmentsSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce numeric strings coming from the query string', () => {
      const result = listAppointmentsSchema.parse({ page: '3', limit: '50' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });

    it('should reject limit above 100', () => {
      expect(() => listAppointmentsSchema.parse({ limit: '500' })).toThrow();
    });
  });

  describe('updateSettingsSchema', () => {
    it('deve aceitar email vazio como "limpar"', () => {
      // O formulário manda string vazia no campo de e-mail. Com `.email()`
      // puro isso reprovava e o dono não conseguia salvar NENHUMA
      // alteração enquanto o e-mail não estivesse preenchido — inclusive
      // a troca do nome da marca.
      const limpo = updateSettingsSchema.parse({ name: 'Salão', email: '' });
      expect(limpo.email).toBeNull();

      // E um e-mail válido continua passando, já normalizado.
      const valido = updateSettingsSchema.parse({
        name: 'Salão',
        email: '  contato@salon.com.br  ',
      });
      expect(valido.email).toBe('contato@salon.com.br');
    });

    it('deve rejeitar email que não é email', () => {
      expect(() => updateSettingsSchema.parse({ name: 'Salão', email: 'nao-e-email' })).toThrow();
    });
    it('should accept valid business hours', () => {
      const result = updateSettingsSchema.parse({
        name: 'Meu Salão',
        businessHours: {
          0: null,
          1: { open: '09:00', close: '19:00' },
          2: { open: '09:00', close: '19:00' },
          3: { open: '09:00', close: '19:00' },
          4: { open: '09:00', close: '19:00' },
          5: { open: '09:00', close: '19:00' },
          6: { open: '09:00', close: '17:00' },
        },
      });
      expect(result.businessHours?.[1]?.open).toBe('09:00');
    });

    it('should accept whatsapp config', () => {
      const result = updateSettingsSchema.parse({
        whatsappApiConfig: {
          provider: 'zapi',
          instanceId: '12345',
          token: 'abcdef',
          apiUrl: 'https://api.z-api.io',
        },
      });
      expect(result.whatsappApiConfig?.provider).toBe('zapi');
    });

    it('should reject an unknown whatsapp provider', () => {
      expect(() =>
        updateSettingsSchema.parse({
          whatsappApiConfig: {
            provider: 'telegram',
            instanceId: '12345',
            token: 'abcdef',
            apiUrl: 'https://api.z-api.io',
          },
        })
      ).toThrow();
    });

    it('should bound bufferMinutes to 0..60', () => {
      expect(() => updateSettingsSchema.parse({ bufferMinutes: 61 })).toThrow();
      expect(() => updateSettingsSchema.parse({ bufferMinutes: -1 })).toThrow();
      expect(() => updateSettingsSchema.parse({ bufferMinutes: 15 })).not.toThrow();
    });
  });

  describe('financialQuerySchema', () => {
    it('should default to month', () => {
      expect(financialQuerySchema.parse({}).period).toBe('month');
    });

    it('should accept day/month/year', () => {
      expect(financialQuerySchema.parse({ period: 'day' }).period).toBe('day');
      expect(financialQuerySchema.parse({ period: 'year' }).period).toBe('year');
    });

    it('should reject unknown period', () => {
      expect(() => financialQuerySchema.parse({ period: 'week' })).toThrow();
    });
  });

  describe('acesso aos dados do salão', () => {
    it('não deve existir schema de edição de salão para o funcionário', async () => {
      // O funcionário perdeu o acesso aos dados do salão: nome, endereço e
      // horário são do proprietário, não de cada profissional. Este teste
      // trava a remoção — se alguém recriar o schema, ele volta a permitir
      // mexer na operação do salão inteiro.
      const validation = await import('@utils/validation');
      expect('employeeSalonInfoSchema' in validation).toBe(false);
    });
  });

  describe('uuidParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = uuidParamSchema.parse({ id: UUID_A });
      expect(result.id).toBe(UUID_A);
    });

    it('should reject invalid UUID', () => {
      expect(() => uuidParamSchema.parse({ id: 'not-a-uuid' })).toThrow();
    });
  });
});