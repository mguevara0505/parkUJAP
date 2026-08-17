import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/database/prisma/prisma.service';
import {
  Credentials,
  E2E_ADMIN,
  E2E_USER,
  createTestApp,
  loginAs,
  removeTestUsers,
  seedTestUsers,
} from './e2e-helpers';

/**
 * E2E Sprint 1 — Autenticación y permisos.
 * Cubre E2E-001 y los casos de prueba listados en el Sprint 1.
 * Requiere PostgreSQL corriendo: docker compose up -d postgres
 */
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
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedTestUsers(prisma);
  });

  afterAll(async () => {
    await removeTestUsers(prisma);
    await app.close();
  });

  const login = (creds: Credentials) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(creds);

  it('E2E-001 — login con credenciales correctas retorna tokens', async () => {
    const res = await login(E2E_USER).expect(200);
    const body = res.body as LoginBody;

    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.email).toBe(E2E_USER.email);
    // Nunca exponer el hash de contraseña (sección 24)
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('login con contraseña incorrecta retorna 401', async () => {
    await login({ email: E2E_USER.email, password: 'ClaveIncorrecta1' }).expect(
      401,
    );
  });

  it('acceso sin token a /auth/me retorna 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('ADMIN puede listar usuarios', async () => {
    const token = await loginAs(app, E2E_ADMIN);

    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const body = res.body as ListBody;
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBeGreaterThan(0);
  });

  it('USER no puede listar usuarios (403)', async () => {
    const token = await loginAs(app, E2E_USER);

    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('refresh rota el token y entrega un nuevo access token', async () => {
    const { refreshToken } = (
      (await login(E2E_USER).expect(200)).body as LoginBody
    ).data;

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
