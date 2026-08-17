import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

/**
 * E2E Sprint 1 — Autenticación y permisos.
 * Cubre E2E-001 y los casos de prueba listados en el Sprint 1 del Documento Maestro.
 *
 * Requiere PostgreSQL corriendo (docker compose up -d postgres) con las migraciones
 * aplicadas. Crea sus propios usuarios `e2e-*` para no depender del seed.
 */
const ADMIN = { email: 'e2e-admin@ujap.edu.ve', password: 'E2eAdmin123' };
const USER = { email: 'e2e-user@ujap.edu.ve', password: 'E2eUser123' };

type Credentials = { email: string; password: string };

interface LoginBody {
  data: {
    accessToken: string;
    refreshToken: string;
    user: { email: string; role: string };
  };
}

interface ListBody {
  data: unknown[];
  meta: { total: number };
}

describe('Auth & Roles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Mismo pipeline que main.ts para que los tests reflejen producción
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

    prisma = app.get(PrismaService);

    for (const [creds, role] of [
      [ADMIN, Role.ADMIN],
      [USER, Role.USER],
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN.email, USER.email] } },
    });
    await app.close();
  });

  const login = (creds: Credentials) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(creds);

  const loginBody = async (creds: Credentials): Promise<LoginBody> => {
    const res = await login(creds).expect(200);
    return res.body as LoginBody;
  };

  const tokenOf = async (creds: Credentials) =>
    (await loginBody(creds)).data.accessToken;

  it('E2E-001 — login con credenciales correctas retorna tokens', async () => {
    const res = await login(USER).expect(200);
    const body = res.body as LoginBody;

    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.email).toBe(USER.email);
    // Nunca exponer el hash de contraseña (sección 24)
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('login con contraseña incorrecta retorna 401', async () => {
    await login({ email: USER.email, password: 'ClaveIncorrecta1' }).expect(
      401,
    );
  });

  it('acceso sin token a /auth/me retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('ADMIN puede listar usuarios', async () => {
    const token = await tokenOf(ADMIN);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.body as ListBody;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBeGreaterThan(0);
  });

  it('USER no puede listar usuarios (403)', async () => {
    const token = await tokenOf(USER);

    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('refresh rota el token y entrega un nuevo access token', async () => {
    const { refreshToken } = (await loginBody(USER)).data;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect((refreshed.body as LoginBody).data.accessToken).toBeDefined();

    // El refresh token anterior quedó invalidado (rotación)
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
