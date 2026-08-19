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
 * En las rutas públicas todavía no hay usuario. Si la petición trae un correo
 * (el login), se agrupa POR ESE CORREO: la fuerza bruta consiste en probar
 * muchas contraseñas contra una misma cuenta, así que ese es el contador que
 * hay que frenar. Agrupar por IP no serviría — todo el campus comparte una — y
 * castigaría a 500 personas por culpa de una.
 *
 * El resto de rutas públicas (refresh) se quedan por IP, que es lo único que
 * las identifica.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: {
    user?: { id?: string };
    body?: { email?: unknown };
    ip?: string;
  }): Promise<string> {
    const userId = req.user?.id;
    if (userId) return Promise.resolve(`user:${userId}`);

    const email = req.body?.email;
    if (typeof email === 'string' && email.length > 0) {
      return Promise.resolve(`login:${email.toLowerCase()}`);
    }

    return Promise.resolve(`ip:${req.ip ?? 'desconocida'}`);
  }
}
