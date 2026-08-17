import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { AuditInterceptor } from '../src/common/interceptors/audit.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';

export type Credentials = { email: string; password: string };

/**
 * Usuarios propios de los E2E: no dependen del seed ni lo modifican.
 *
 * Las suites los comparten, así que `test:e2e` corre con `--runInBand`: sobre
 * una única base de datos, dos suites en paralelo se pisarían los datos (una
 * borra los usuarios mientras la otra todavía usa su token). Imprescindible
 * también para las pruebas de concurrencia del Sprint 6.
 */
export const E2E_ADMIN: Credentials = {
  email: 'e2e-admin@ujap.edu.ve',
  password: 'E2eAdmin123',
};
export const E2E_USER: Credentials = {
  email: 'e2e-user@ujap.edu.ve',
  password: 'E2eUser123',
};

/**
 * Arranca la aplicación con el mismo pipeline global que `main.ts`
 * (prefijo, ValidationPipe, filtro de excepciones e interceptor de respuesta)
 * para que los tests reflejen el comportamiento real de la API.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  // Mismo orden que main.ts para que los tests ejerciten la auditoría real
  app.useGlobalInterceptors(
    new AuditInterceptor(app.get(AuditService)),
    new ResponseInterceptor(),
  );

  await app.init();

  // Detener los cron: cada suite abre y cierra su propia app, y un job que
  // dispara después del cierre lo hace contra un cliente Prisma ya
  // desconectado. Las suites invocan `tick()` directamente, que además es la
  // forma correcta de probar un job: sin esperar a que pase un minuto.
  const registry = app.get(SchedulerRegistry);
  for (const [name] of registry.getCronJobs()) {
    registry.deleteCronJob(name);
  }

  return app;
}

/** Crea (o restablece) los usuarios ADMIN y USER de pruebas. */
export async function seedTestUsers(prisma: PrismaService): Promise<void> {
  for (const [creds, role] of [
    [E2E_ADMIN, Role.ADMIN],
    [E2E_USER, Role.USER],
  ] as const) {
    const passwordHash = await bcrypt.hash(creds.password, 10);
    await prisma.user.upsert({
      where: { email: creds.email },
      update: { passwordHash, role, status: UserStatus.ACTIVE },
      create: {
        firstName: 'E2E',
        lastName: role,
        email: creds.email,
        passwordHash,
        role,
        status: UserStatus.ACTIVE,
      },
    });
  }
}

export async function removeTestUsers(prisma: PrismaService): Promise<void> {
  await purgeUsers(prisma, {
    email: { in: [E2E_ADMIN.email, E2E_USER.email] },
  });
}

/**
 * Borra usuarios de prueba y lo que cuelga de ellos.
 *
 * En producción un usuario nunca se borra —se desactiva— justamente para no
 * perder su rastro, así que la clave ajena de `audit_logs` es la correcta. Los
 * tests sí borran de verdad, y por eso tienen que limpiar antes su auditoría.
 */
export async function purgeUsers(
  prisma: PrismaService,
  where: { email?: { in: string[] }; id?: { in: string[] } },
): Promise<void> {
  const users = await prisma.user.findMany({ where, select: { id: true } });
  const userId = { in: users.map((u) => u.id) };

  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.parkingSession.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

interface LoginResponse {
  data: { accessToken: string; refreshToken: string };
}

/** Inicia sesión y devuelve el access token listo para la cabecera Bearer. */
export async function loginAs(
  app: INestApplication<App>,
  creds: Credentials,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send(creds)
    .expect(200);

  return (res.body as LoginResponse).data.accessToken;
}
