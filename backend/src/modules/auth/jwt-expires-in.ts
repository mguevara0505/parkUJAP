import { ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';

/**
 * `expiresIn` de jsonwebtoken usa un tipo plantilla ('15m', '7d', número de segundos),
 * mientras que las variables de entorno siempre llegan como string.
 * Este helper concentra esa conversión para no repetir el cast en cada firma.
 */
export function expiresIn(
  config: ConfigService,
  key: 'JWT_ACCESS_EXPIRES_IN' | 'JWT_REFRESH_EXPIRES_IN',
  fallback: string,
): JwtSignOptions['expiresIn'] {
  return config.get<string>(key, fallback) as JwtSignOptions['expiresIn'];
}
