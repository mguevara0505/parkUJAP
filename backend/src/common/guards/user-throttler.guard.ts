import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting por usuario autenticado en lugar de por IP.
 *
 * El ThrottlerGuard por defecto agrupa por IP. En la universidad casi todo el
 * tráfico sale por el NAT del campus con una única IP pública: con el límite
 * por IP, un solo estudiante consumiría la cuota de todos, y la prueba de carga
 * de 100 usuarios simultáneos (sección 11) fallaría por diseño.
 *
 * Las rutas públicas (login, refresh) no tienen usuario todavía y siguen
 * limitándose por IP, que es justo lo que se quiere contra la fuerza bruta.
 *
 * ponytail: /auth/login merece además un límite propio más estricto que el
 * resto de la API. Pendiente para el endurecimiento del Sprint 11.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: {
    user?: { id?: string };
    ip?: string;
  }): Promise<string> {
    const userId = req.user?.id;
    return Promise.resolve(
      userId ? `user:${userId}` : `ip:${req.ip ?? 'desconocida'}`,
    );
  }
}
