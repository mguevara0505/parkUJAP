import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './database/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ParkingLotsModule } from './modules/parking-lots/parking-lots.module';
import { ParkingZonesModule } from './modules/parking-zones/parking-zones.module';
import { ParkingSpacesModule } from './modules/parking-spaces/parking-spaces.module';
import { ParkingSessionsModule } from './modules/parking-sessions/parking-sessions.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { VisitorsModule } from './modules/visitors/visitors.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import appConfig from './config/app.config';

@Module({
  imports: [
    // Configuración de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      // El primero que exista gana. Así `NODE_ENV=test` toma .env.test y
      // producción toma .env, sin tocar código al desplegar.
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
    }),

    // Rate limiting — protección contra abuso (sección 24).
    // 'short' a 30/s porque una sola pantalla dispara varias peticiones en
    // paralelo (mapa + zonas + sesión activa); con 10/s se bloqueaba a sí misma.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 30 },
      { name: 'medium', ttl: 10000, limit: 120 },
      { name: 'long', ttl: 60000, limit: 600 },
    ]),

    // Scheduler para jobs (activar/finalizar reservas, mantenimiento)
    ScheduleModule.forRoot(),

    // Base de datos
    PrismaModule,

    // Módulos funcionales
    AuthModule,
    UsersModule,
    ParkingLotsModule,
    ParkingZonesModule,
    ParkingSpacesModule,
    ParkingSessionsModule,
    ReservationsModule,
    VisitorsModule,
    MaintenanceModule,
    DashboardModule,
    AuditModule,
    HealthModule,
  ],
  providers: [
    // JwtAuthGuard aplicado globalmente — sección 24: nunca confiar en el frontend
    // Las rutas públicas usan @Public() para saltar la validación
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Rate limiting global. Va después del guard JWT para que `req.user` ya
    // exista y la cuota se cuente por usuario, no por la IP del NAT del campus.
    {
      provide: APP_GUARD,
      useClass: UserThrottlerGuard,
    },
  ],
})
export class AppModule {}
