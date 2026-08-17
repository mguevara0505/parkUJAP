import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * Auditoría automática de toda operación que modifica datos (RN-011).
 *
 * Va en un interceptor global y no en cada servicio a propósito: el enfoque
 * explícito falla EN ABIERTO — quien añada un endpoint mañana y olvide la
 * llamada deja un hueco silencioso en la trazabilidad. Aquí, cualquier ruta
 * nueva queda auditada por el solo hecho de existir.
 *
 * Solo registra escrituras con éxito de usuarios autenticados. Las lecturas no
 * se auditan: multiplicarían las filas por mil sin aportar trazabilidad.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private static readonly WRITE_METHODS = new Set([
    'POST',
    'PATCH',
    'PUT',
    'DELETE',
  ]);

  /**
   * Rutas que no se auditan: el login lleva contraseña y el refresh, tokens.
   * Aunque el servicio los ocultaría, es más seguro no tocarlos.
   */
  private static readonly SKIP = ['/auth/login', '/auth/refresh'];

  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      originalUrl?: string;
      params?: Record<string, string>;
      body?: unknown;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
      user?: { id?: string };
    }>();

    const path = req.originalUrl ?? req.url;

    const shouldAudit =
      AuditInterceptor.WRITE_METHODS.has(req.method) &&
      Boolean(req.user?.id) &&
      !AuditInterceptor.SKIP.some((skip) => path.includes(skip));

    if (!shouldAudit) return next.handle();

    // Solo se audita si la operación tuvo éxito: un intento rechazado ya queda
    // en el log de errores y no cambió nada que rastrear.
    //
    // Se ESPERA a que la fila exista antes de responder. Disparar y olvidar
    // costaría un milisegundo menos, pero perdería el rastro si el proceso
    // muere justo después de responder — y un rastro que a veces falta no
    // sirve como rastro. `record` nunca lanza, así que una auditoría rota
    // jamás tumba la operación del usuario.
    return next.handle().pipe(
      concatMap(async (response: unknown) => {
        await this.audit.record({
          userId: req.user!.id!,
          action: this.deriveAction(req.method, path),
          entityType: this.deriveEntityType(path),
          entityId: this.deriveEntityId(response, req.params),
          newValue: req.body,
          ipAddress: req.ip,
          userAgent: this.headerValue(req.headers['user-agent']),
        });

        return response;
      }),
    );
  }

  /**
   * Nombre legible de la acción, con los ejemplos de la sección 14:
   * SPACE_DISABLED, RESERVATION_CANCELLED, USER_CREATED...
   */
  private deriveAction(method: string, path: string): string {
    const segments = this.pathSegments(path);
    const entity = this.entityWord(segments);

    // Sub-acción explícita al final de la ruta: /reservations/:id/cancel
    const last = segments[segments.length - 1];
    if (last && !this.looksLikeId(last) && segments.length > 1) {
      return `${entity}_${last.replace(/-/g, '_').toUpperCase()}`;
    }

    switch (method) {
      case 'POST':
        return `${entity}_CREATED`;
      case 'PATCH':
      case 'PUT':
        return `${entity}_UPDATED`;
      case 'DELETE':
        // Nada se borra de verdad en este sistema: se desactiva
        return `${entity}_DISABLED`;
      default:
        return `${entity}_${method}`;
    }
  }

  private deriveEntityType(path: string): string {
    return this.pathSegments(path)[0] ?? 'unknown';
  }

  private deriveEntityId(
    response: unknown,
    params?: Record<string, string>,
  ): string | undefined {
    // El id de la respuesta es más fiable: en un POST no existe en la ruta
    const data =
      response && typeof response === 'object' && 'data' in response
        ? (response as { data?: unknown }).data
        : response;

    if (data && typeof data === 'object' && 'id' in data) {
      const id = (data as { id?: unknown }).id;
      if (typeof id === 'string') return id;
    }

    return params?.id;
  }

  /** Segmentos de la ruta sin el prefijo de API ni la query string. */
  private pathSegments(path: string): string[] {
    return path
      .split('?')[0]
      .replace(/^\/api\/v\d+/, '')
      .split('/')
      .filter(Boolean);
  }

  /** "parking-spaces" → "SPACE"; "users" → "USER". */
  private entityWord(segments: string[]): string {
    const resource = segments[0] ?? 'entity';
    const word = resource.split('-').pop() ?? resource;
    return word.replace(/s$/, '').toUpperCase();
  }

  private looksLikeId(segment: string): boolean {
    return /^[0-9a-f-]{8,}$/i.test(segment);
  }

  private headerValue(
    value: string | string[] | undefined,
  ): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
}
