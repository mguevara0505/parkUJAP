import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Límite propio del login, mucho más estricto que el resto de la API
 * (sección 24). Cuenta por correo, no por IP: ver UserThrottlerGuard.
 *
 * Diez intentos cada cinco minutos deja margen de sobra a quien teclea mal la
 * contraseña y hace inviable probar un diccionario.
 *
 * Los tests e2e sí repiten logins fallidos a propósito, así que en entorno de
 * prueba el límite se levanta. `NODE_ENV` ya vale 'test' cuando Jest importa
 * este archivo, que es cuando se evalúa el decorador.
 */
const LOGIN_MAX_ATTEMPTS = Number(
  process.env.LOGIN_MAX_ATTEMPTS ??
    (process.env.NODE_ENV === 'test' ? 10_000 : 10),
);
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/login
   * Sección 23 — CU-001
   */
  @Public()
  @Throttle({ short: { limit: LOGIN_MAX_ATTEMPTS, ttl: LOGIN_WINDOW_MS } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens JWT' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales incorrectas' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  /**
   * POST /api/v1/auth/refresh
   * Sección 23 — Renovar access token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar access token usando refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens renovados' })
  @ApiResponse({ status: 401, description: 'Refresh token inválido' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  /**
   * POST /api/v1/auth/logout
   * Sección 23 — Cerrar sesión
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cerrar sesión e invalidar refresh token' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto: Partial<RefreshTokenDto>,
  ) {
    return this.authService.logout(userId, dto.refreshToken);
  }

  /**
   * GET /api/v1/auth/me
   * Sección 23 — Perfil del usuario autenticado
   */
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil del usuario' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  async me(@CurrentUser('id') userId: string) {
    return this.authService.me(userId);
  }
}
