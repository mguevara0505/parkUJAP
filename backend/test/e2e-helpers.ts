import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

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
  app.useGlobalInterceptors(new ResponseInterceptor());

  await app.init();
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
  await prisma.user.deleteMany({
    where: { email: { in: [E2E_ADMIN.email, E2E_USER.email] } },
  });
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
