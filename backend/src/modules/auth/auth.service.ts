import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { expiresIn } from './jwt-expires-in';

/**
 * Los refresh tokens se guardan hasheados con SHA-256, no con bcrypt.
 * bcrypt solo considera los primeros 72 bytes: como todos los JWT de un mismo
 * usuario comparten ese prefijo, cualquier token viejo pasaba la comparación y
 * la rotación no invalidaba nada. El token ya es aleatorio de alta entropía
 * (incluye un `jti`), así que no necesita una KDF lenta contra fuerza bruta.
 * Ventaja adicional: permite búsqueda directa por igualdad en lugar de recorrer
 * todos los tokens del usuario comparando uno por uno.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Valida credenciales del usuario.
   * Usado por la estrategia local.
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Cuenta inactiva o suspendida');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return user;
  }

  /**
   * Login: valida credenciales y retorna access + refresh token.
   * Sección 23 — POST /auth/login
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.validateUser(dto.email, dto.password);

    const tokens = await this.issueTokens(user.id, user.email, user.role);

    // Actualizar lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Sección 32 — registrar login sin exponer contraseñas ni tokens
    this.logger.log(
      `Login exitoso: ${user.email} [${user.role}] desde ${ipAddress ?? 'ip-desconocida'} (${userAgent ?? 'ua-desconocido'})`,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        // El mapa resalta las zonas del usuario nada más iniciar sesión
        category: user.category,
      },
    };
  }

  /**
   * Renovar access token usando un refresh token válido.
   * Sección 23 — POST /auth/refresh
   */
  async refresh(refreshToken: string) {
    let payload: { sub: string; email: string; role: string };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Búsqueda directa por hash — el token es único e indexado
    const validToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: hashToken(refreshToken),
        userId: payload.sub,
        expiresAt: { gt: new Date() },
      },
    });

    if (!validToken) {
      throw new UnauthorizedException('Refresh token no reconocido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    // Rotar el refresh token — invalidar el anterior
    await this.prisma.refreshToken.delete({ where: { id: validToken.id } });

    return this.issueTokens(user.id, user.email, user.role);
  }

  /**
   * Logout: invalida el refresh token.
   * Sección 23 — POST /auth/logout
   */
  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      // Invalidar solo el token específico (logout de este dispositivo)
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: hashToken(refreshToken) },
      });
    } else {
      // Invalidar todos los refresh tokens (logout de todos los dispositivos)
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }

    this.logger.log(`Logout: usuario ${userId}`);
    return { message: 'Sesión cerrada correctamente' };
  }

  /**
   * Retorna el perfil del usuario autenticado.
   * Sección 23 — GET /auth/me
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        category: true,
        universityId: true,
        documentId: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Genera access + refresh token y persiste el refresh token hasheado.
   * Único punto de emisión de sesión (usado por login y refresh) para no duplicar lógica.
   */
  private async issueTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: expiresIn(this.config, 'JWT_ACCESS_EXPIRES_IN', '15m'),
      }),
      // jti único: sin él, dos logins en el mismo segundo generan el mismo JWT
      // y la rotación del refresh token no invalidaría nada.
      this.jwtService.signAsync(
        { ...payload, jti: randomUUID() },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: expiresIn(this.config, 'JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    // La expiración en BD se deriva del propio JWT, no de una constante duplicada
    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),
        userId,
        expiresAt: new Date(exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }
}
