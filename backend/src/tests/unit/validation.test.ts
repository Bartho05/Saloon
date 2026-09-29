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
  uuidParamSchema,
} from '@utils/validation';

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
        body: { email: 'owner@salao.com', password: '123456' },
      });
      expect(result.body.email).toBe('owner@salao.com');
    });

    it('should reject invalid email', () => {
      expect(() => ownerLoginSchema.parse({
        body: { email: 'invalid-email', password: '123456' },
      })).toThrow();
    });

    it('should reject short password', () => {
      expect(() => ownerLoginSchema.parse({
        body: { email: 'owner@salao.com', password: '123' },
      })).toThrow();
    });
  });

  describe('employeeLoginSchema', () => {
    it('should accept valid 6-digit access code', () => {
      const result = employeeLoginSchema.parse({
        body: { accessCode: '123456' },
      });
      expect(result.body.accessCode).toBe('123456');
    });

    it('should reject non-6-digit codes', () => {
      expect(() => employeeLoginSchema.parse({ body: { accessCode: '12345' } })).toThrow();
      expect(() => employeeLoginSchema.parse({ body: { accessCode: '1234567' } })).toThrow();
      expect(() => employeeLoginSchema.parse({ body: { accessCode: 'abcdef' } })).toThrow();
    });
  });

  describe('clientRequestCodeSchema', () => {
    it('should accept valid phone', () => {
      const result = clientRequestCodeSchema.parse({
        body: { phone: '11999999999' },
      });
      expect(result.body.phone).toBe('11999999999');
    });
  });

  describe('clientVerifyCodeSchema', () => {
    it('should accept valid phone and 6-digit code', () => {
      const result = clientVerifyCodeSchema.parse({
        body: { phone: '11999999999', code: '123456' },
      });
      expect(result.body.code).toBe('123456');
    });

    it('should reject invalid code length', () => {
      expect(() => clientVerifyCodeSchema.parse({
        body: { phone: '11999999999', code: '12345' },
      })).toThrow();
    });
  });

  describe('createServiceSchema', () => {
    it('should accept valid service data', () => {
      const result = createServiceSchema.parse({
        body: {
          name: 'Corte Feminino',
          description: 'Corte moderno',
          durationMinutes: 60,
          price: 80.00,
        },
      });
      expect(result.body.name).toBe('Corte Feminino');
    });

    it('should reject short name', () => {
      expect(() => createServiceSchema.parse({
        body: { name: 'C', durationMinutes: 30, price: 50 },
      })).toThrow();
    });

    it('should reject invalid duration', () => {
      expect(() => createServiceSchema.parse({
        body: { name: 'Corte', durationMinutes: 10, price: 50 },
      })).toThrow(); // mínimo 15 min

      expect(() => createServiceSchema.parse({
        body: { name: 'Corte', durationMinutes: 500, price: 50 },
      })).toThrow(); // máximo 480 min
    });

    it('should reject non-positive price', () => {
      expect(() => createServiceSchema.parse({
        body: { name: 'Corte', durationMinutes: 30, price: 0 },
      })).toThrow();

      expect(() => createServiceSchema.parse({
        body: { name: 'Corte', durationMinutes: 30, price: -10 },
      })).toThrow();
    });
  });

  describe('updateServiceSchema', () => {
    it('should accept partial updates', () => {
      const result = updateServiceSchema.parse({
        body: { name: 'Novo Nome' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(result.body.name).toBe('Novo Nome');
    });

    it('should reject invalid UUID', () => {
      expect(() => updateServiceSchema.parse({
        body: { name: 'Teste' },
        params: { id: 'invalid-uuid' },
      })).toThrow();
    });
  });

  describe('createEmployeeSchema', () => {
    it('should accept valid employee data', () => {
      const result = createEmployeeSchema.parse({
        body: {
          name: 'Maria Silva',
          phone: '11999999999',
          specialties: ['Corte', 'Escova'],
          serviceIds: ['123e4567-e89b-12d3-a456-426614174000'],
        },
      });
      expect(result.body.name).toBe('Maria Silva');
    });

    it('should require at least one specialty', () => {
      expect(() => createEmployeeSchema.parse({
        body: {
          name: 'Maria',
          phone: '11999999999',
          specialties: [],
          serviceIds: ['123e4567-e89b-12d3-a456-426614174000'],
        },
      })).toThrow();
    });
  });

  describe('getSlotsSchema', () => {
    it('should accept valid query params', () => {
      const result = getSlotsSchema.parse({
        query: {
          employeeId: '123e4567-e89b-12d3-a456-426614174000',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          date: '2025-01-15',
        },
      });
      expect(result.query.date).toBe('2025-01-15');
    });

    it('should reject invalid date format', () => {
      expect(() => getSlotsSchema.parse({
        query: {
          employeeId: '123e4567-e89b-12d3-a456-426614174000',
          serviceId: '123e4567-e89b-12d3-a456-426614174001',
          date: '15/01/2025',
        },
      })).toThrow();
    });
  });

  describe('createBookingSchema', () => {
    it('should accept complete booking data for new client', () => {
      const result = createBookingSchema.parse({
        body: {
          serviceId: '123e4567-e89b-12d3-a456-426614174000',
          employeeId: '123e4567-e89b-12d3-a456-426614174001',
          startsAt: '2025-01-15T10:00:00-03:00',
          client: {
            phone: '11999999999',
            fullName: 'João Silva',
            birthDate: '1990-05-15',
          },
        },
      });
      expect(result.body.client.fullName).toBe('João Silva');
    });

    it('should accept booking for existing client (only phone)', () => {
      const result = createBookingSchema.parse({
        body: {
          serviceId: '123e4567-e89b-12d3-a456-426614174000',
          employeeId: '123e4567-e89b-12d3-a456-426614174001',
          startsAt: '2025-01-15T10:00:00-03:00',
          client: {
            phone: '11999999999',
          },
        },
      });
      expect(result.body.client.phone).toBe('11999999999');
      expect(result.body.client.fullName).toBeUndefined();
    });

    it('should reject invalid ISO datetime', () => {
      expect(() => createBookingSchema.parse({
        body: {
          serviceId: '123e4567-e89b-12d3-a456-426614174000',
          employeeId: '123e4567-e89b-12d3-a456-426614174001',
          startsAt: '2025-01-15 10:00:00', // sem timezone
          client: { phone: '11999999999' },
        },
      })).toThrow();
    });
  });

  describe('updateAppointmentStatusSchema', () => {
    it('should accept valid status transitions', () => {
      const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
      for (const status of validStatuses) {
        const result = updateAppointmentStatusSchema.parse({
          params: { id: '123e4567-e89b-12d3-a456-426614174000' },
          body: { status },
        });
        expect(result.body.status).toBe(status);
      }
    });

    it('should reject invalid status', () => {
      expect(() => updateAppointmentStatusSchema.parse({
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
        body: { status: 'INVALID' },
      })).toThrow();
    });
  });

  describe('updateSettingsSchema', () => {
    it('should accept valid business hours', () => {
      const result = updateSettingsSchema.parse({
        body: {
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
        },
      });
      expect(result.body.businessHours?.[1]?.open).toBe('09:00');
    });

    it('should accept whatsapp config', () => {
      const result = updateSettingsSchema.parse({
        body: {
          whatsappApiConfig: {
            provider: 'zapi',
            instanceId: '12345',
            token: 'abcdef',
            apiUrl: 'https://api.z-api.io',
          },
        },
      });
      expect(result.body.whatsappApiConfig?.provider).toBe('zapi');
    });
  });

  describe('uuidParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = uuidParamSchema.parse({
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      });
      expect(result.params.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should reject invalid UUID', () => {
      expect(() => uuidParamSchema.parse({ params: { id: 'not-a-uuid' } })).toThrow();
    });
  });
});