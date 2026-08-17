import { HttpStatus } from '@nestjs/common';
import { translatePrismaError } from './http-exception.filter';

describe('translatePrismaError', () => {
  it('P2002 con driver adapter nombra el campo en conflicto', () => {
    // Forma real de Prisma 7 + PrismaPg: los campos vienen anidados en
    // driverAdapterError, no en meta.target
    const result = translatePrismaError({
      code: 'P2002',
      meta: {
        driverAdapterError: {
          cause: { constraint: { fields: ['code'] } },
        },
      },
    });

    expect(result.statusCode).toBe(HttpStatus.CONFLICT);
    expect(result.message).toContain('code');
    expect(result.message).not.toContain('undefined');
  });

  it('P2002 con el cliente clásico también nombra el campo', () => {
    const result = translatePrismaError({
      code: 'P2002',
      meta: { target: ['email'] },
    });

    expect(result.statusCode).toBe(HttpStatus.CONFLICT);
    expect(result.message).toContain('email');
  });

  it('P2002 sin metadatos no imprime "undefined"', () => {
    const result = translatePrismaError({ code: 'P2002' });

    expect(result.statusCode).toBe(HttpStatus.CONFLICT);
    expect(result.message).not.toContain('undefined');
  });

  it('P2025 traduce a 404', () => {
    expect(translatePrismaError({ code: 'P2025' }).statusCode).toBe(
      HttpStatus.NOT_FOUND,
    );
  });

  it('P2003 traduce a 400: la referencia enviada es del cliente', () => {
    expect(translatePrismaError({ code: 'P2003' }).statusCode).toBe(
      HttpStatus.BAD_REQUEST,
    );
  });

  it('un P2xxx desconocido es 500, no 400', () => {
    // No se sabe si fue culpa del cliente: no atribuirle el fallo
    expect(translatePrismaError({ code: 'P2099' }).statusCode).toBe(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  });

  describe('fallos de infraestructura, no del cliente', () => {
    // Un 400 aquí culparía al usuario de que la base de datos esté caída
    it.each(['ECONNREFUSED', 'P1001', 'P1002', 'P1017'])(
      '%s traduce a 503',
      (code) => {
        const result = translatePrismaError({ code });

        expect(result.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(result.code).toBe('DATABASE_UNAVAILABLE');
      },
    );
  });
});
