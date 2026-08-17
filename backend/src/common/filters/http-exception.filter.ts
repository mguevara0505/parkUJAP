import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Extrae los campos que violaron una restricción única.
 *
 * Prisma expone esto en dos formatos según el motor: `meta.target` con el
 * cliente clásico, y `meta.driverAdapterError.cause.constraint.fields` cuando
 * se usa un driver adapter como PrismaPg (nuestro caso). Se soportan ambos
 * para que el mensaje no diga "undefined" si cambia la configuración.
 */
function uniqueConstraintFields(
  meta: Record<string, unknown> | undefined,
): string | null {
  // PostgreSQL devuelve los identificadores entrecomillados ("documentId");
  // el mensaje lo lee una persona, no un parser
  const clean = (value: string) => value.replace(/"/g, '');

  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String).map(clean).join(', ');
  if (typeof target === 'string') return clean(target);

  const constraint = (
    meta?.driverAdapterError as
      | { cause?: { constraint?: { fields?: string[]; index?: string } } }
      | undefined
  )?.cause?.constraint;

  if (Array.isArray(constraint?.fields)) {
    return constraint.fields.map(String).map(clean).join(', ');
  }
  if (typeof constraint?.index === 'string') return clean(constraint.index);

  return null;
}

/**
 * Traduce errores conocidos de Prisma al formato de error de la sección 31.
 * Vive en el filtro global para que ningún módulo tenga que repetir este mapeo.
 * Referencia de códigos: https://www.prisma.io/docs/reference/api-reference/error-reference
 *
 * Exportada para poder probar la tabla de correspondencias sin tumbar la base
 * de datos en un test.
 */
export function translatePrismaError(e: { code: string; meta?: unknown }) {
  switch (e.code) {
    case 'P2002': {
      // Violación de restricción única — p. ej. dos puestos con el mismo código
      const fields = uniqueConstraintFields(
        e.meta as Record<string, unknown> | undefined,
      );
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: fields
          ? `Ya existe un registro con ese valor en: ${fields}`
          : 'Ya existe un registro con ese valor único',
      };
    }
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        code: 'RECORD_NOT_FOUND',
        message: 'El registro solicitado no existe',
      };
    case 'P2003':
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        message: 'La referencia indicada no existe',
      };
    case 'P2014':
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        code: 'RELATION_CONSTRAINT_VIOLATION',
        message:
          'La operación rompería una relación existente. Desactive el registro en lugar de eliminarlo',
      };
    default:
      // Solo los errores de consulta (P2xxx) pueden deberse a datos del
      // cliente. Los P1xxx y los del driver (ECONNREFUSED, ETIMEDOUT) son
      // fallos de infraestructura: devolver 400 culparía al cliente de que la
      // base de datos esté caída, y ocultaría la caída en las métricas.
      if (e.code.startsWith('P2')) {
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Internal Server Error',
          code: `PRISMA_${e.code}`,
          message: 'La operación no pudo completarse en la base de datos',
        };
      }

      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        code: 'DATABASE_UNAVAILABLE',
        message:
          'La base de datos no está disponible en este momento. Intente nuevamente en unos instantes',
      };
  }
}

/**
 * Filtro global de excepciones HTTP.
 * Formato de error definido en sección 31 del Documento Maestro.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';
    let error = 'Internal Server Error';
    let code = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) || exception.message;
        error = (resp['error'] as string) || exception.name;
        code = (resp['code'] as string) || this.getErrorCode(statusCode);
      } else {
        message = exceptionResponse;
        error = exception.name;
        code = this.getErrorCode(statusCode);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // La restricción de la base de datos es la autoridad final: validar antes
      // con un SELECT sería una condición de carrera (sección 25).
      ({ statusCode, error, code, message } = translatePrismaError(exception));
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Error no controlado: ${exception.message}`,
        exception.stack,
      );
    }

    const errorResponse = {
      statusCode,
      error,
      code,
      message: Array.isArray(message) ? message.join(', ') : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${statusCode}: ${message}`,
      );
    }

    response.status(statusCode).json(errorResponse);
  }

  private getErrorCode(statusCode: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[statusCode] || 'UNKNOWN_ERROR';
  }
}
