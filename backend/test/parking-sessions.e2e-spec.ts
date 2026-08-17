import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Role, SessionStatus, SpaceStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import {
  E2E_ADMIN,
  E2E_USER,
  createTestApp,
  loginAs,
  removeTestUsers,
  seedTestUsers,
} from './e2e-helpers';

/**
 * E2E Sprint 5 y 6 — registro de ocupación y concurrencia.
 * Cubre E2E-003, E2E-004, E2E-005 y E2E-009 del Documento Maestro.
 * Requiere el seed aplicado.
 */
const RIVALS = Array.from({ length: 10 }, (_, i) => ({
  email: `e2e-rival${i}@ujap.edu.ve`,
  password: 'E2eRival123',
}));

interface SessionBody {
  data: {
    id: string;
    status: SessionStatus;
    checkInAt: string;
    checkOutAt: string | null;
    parkingSpace: { id: string; code: string };
  };
}

describe('Parking Sessions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let userToken: string;
  let adminToken: string;
  let rivalTokens: string[];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  /** Deja un puesto conocido en AVAILABLE y sin sesiones previas. */
  const resetSpace = async (code: string) => {
    const space = await prisma.parkingSpace.findUniqueOrThrow({
      where: { code },
    });
    await prisma.parkingSession.deleteMany({
      where: { parkingSpaceId: space.id },
    });
    await prisma.parkingSpace.update({
      where: { id: space.id },
      data: { status: SpaceStatus.AVAILABLE },
    });
    return space;
  };

  const clearSessionsOf = (emails: string[]) =>
    prisma.parkingSession.deleteMany({
      where: { user: { email: { in: emails } } },
    });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedTestUsers(prisma);

    // 10 usuarios rivales para la prueba de concurrencia
    const passwordHash = await bcrypt.hash(RIVALS[0].password, 10);
    for (const [i, rival] of RIVALS.entries()) {
      await prisma.user.upsert({
        where: { email: rival.email },
        update: { passwordHash, status: UserStatus.ACTIVE },
        create: {
          firstName: 'Rival',
          lastName: String(i),
          email: rival.email,
          passwordHash,
          role: Role.USER,
          status: UserStatus.ACTIVE,
        },
      });
    }

    userToken = await loginAs(app, E2E_USER);
    adminToken = await loginAs(app, E2E_ADMIN);
    rivalTokens = await Promise.all(RIVALS.map((r) => loginAs(app, r)));
  });

  afterAll(async () => {
    const emails = [
      E2E_USER.email,
      E2E_ADMIN.email,
      ...RIVALS.map((r) => r.email),
    ];
    await clearSessionsOf(emails);
    await prisma.user.deleteMany({
      where: { email: { in: RIVALS.map((r) => r.email) } },
    });
    await removeTestUsers(prisma);

    // Devolver los puestos usados a su estado inicial
    await prisma.parkingSpace.updateMany({
      where: { code: { in: ['E-001', 'E-002', 'E-003', 'E-004', 'E-005'] } },
      data: { status: SpaceStatus.AVAILABLE },
    });
    await app.close();
  });

  beforeEach(async () => {
    await clearSessionsOf([
      E2E_USER.email,
      E2E_ADMIN.email,
      ...RIVALS.map((r) => r.email),
    ]);
  });

  describe('E2E-003 — registrar ocupación', () => {
    it('el check-in crea la sesión y deja el puesto OCCUPIED', async () => {
      const space = await resetSpace('E-001');

      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      const { data } = res.body as SessionBody;
      expect(data.status).toBe(SessionStatus.ACTIVE);
      expect(data.parkingSpace.code).toBe('E-001');
      expect(data.checkOutAt).toBeNull();

      const after = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: space.id },
      });
      expect(after.status).toBe(SpaceStatus.OCCUPIED);
    });

    it('/me/active devuelve la sesión en curso', async () => {
      const space = await resetSpace('E-001');
      await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      const res = await http()
        .get('/api/v1/parking-sessions/me/active')
        .set(auth(userToken))
        .expect(200);

      expect((res.body as SessionBody).data.parkingSpace.code).toBe('E-001');
    });

    it('RN-002: el mismo usuario no puede ocupar un segundo puesto', async () => {
      const first = await resetSpace('E-001');
      const second = await resetSpace('E-002');

      await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: first.id })
        .expect(201);

      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: second.id })
        .expect(409);

      expect((res.body as { code: string }).code).toBe(
        'USER_ALREADY_HAS_ACTIVE_SESSION',
      );

      // El segundo puesto no debe haberse tocado
      const untouched = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: second.id },
      });
      expect(untouched.status).toBe(SpaceStatus.AVAILABLE);
    });

    // RN-003 (DISABLED) y RN-004 (MAINTENANCE)
    it.each([SpaceStatus.DISABLED, SpaceStatus.MAINTENANCE])(
      'E2E-009 — un puesto %s no puede ocuparse',
      async (status) => {
        const space = await resetSpace('E-003');
        await prisma.parkingSpace.update({
          where: { id: space.id },
          data: { status },
        });

        const res = await http()
          .post('/api/v1/parking-sessions/check-in')
          .set(auth(userToken))
          .send({ parkingSpaceId: space.id })
          .expect(409);

        expect((res.body as { code: string }).code).toBe(
          'PARKING_SPACE_NOT_AVAILABLE',
        );

        const after = await prisma.parkingSpace.findUniqueOrThrow({
          where: { id: space.id },
        });
        expect(after.status).toBe(status);
      },
    );
  });

  describe('E2E-004 — concurrencia (sección 25)', () => {
    it('2 usuarios sobre el mismo puesto: uno gana, el otro recibe 409', async () => {
      const space = await resetSpace('E-004');

      const [a, b] = await Promise.all(
        rivalTokens
          .slice(0, 2)
          .map((token) =>
            http()
              .post('/api/v1/parking-sessions/check-in')
              .set(auth(token))
              .send({ parkingSpaceId: space.id }),
          ),
      );

      const codes = [a.status, b.status].sort();
      expect(codes).toEqual([201, 409]);

      const sessions = await prisma.parkingSession.count({
        where: { parkingSpaceId: space.id, status: SessionStatus.ACTIVE },
      });
      expect(sessions).toBe(1);
    });

    it('10 usuarios sobre el mismo puesto: exactamente una sesión activa', async () => {
      const space = await resetSpace('E-005');

      const responses = await Promise.all(
        rivalTokens.map((token) =>
          http()
            .post('/api/v1/parking-sessions/check-in')
            .set(auth(token))
            .send({ parkingSpaceId: space.id }),
        ),
      );

      const created = responses.filter((r) => r.status === 201);
      const rejected = responses.filter((r) => r.status === 409);

      expect(created).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      const active = await prisma.parkingSession.findMany({
        where: { parkingSpaceId: space.id, status: SessionStatus.ACTIVE },
      });
      expect(active).toHaveLength(1);

      const after = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: space.id },
      });
      expect(after.status).toBe(SpaceStatus.OCCUPIED);
    });

    it('un mismo usuario pulsando dos veces solo crea una sesión (RN-002)', async () => {
      const first = await resetSpace('E-001');
      const second = await resetSpace('E-002');

      const responses = await Promise.all([
        http()
          .post('/api/v1/parking-sessions/check-in')
          .set(auth(userToken))
          .send({ parkingSpaceId: first.id }),
        http()
          .post('/api/v1/parking-sessions/check-in')
          .set(auth(userToken))
          .send({ parkingSpaceId: second.id }),
      ]);

      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);

      const active = await prisma.parkingSession.count({
        where: {
          user: { email: E2E_USER.email },
          status: SessionStatus.ACTIVE,
        },
      });
      expect(active).toBe(1);
    });
  });

  describe('E2E-005 — liberar el puesto', () => {
    it('el check-out cierra la sesión y devuelve el puesto a AVAILABLE (RN-015)', async () => {
      const space = await resetSpace('E-001');

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      const sessionId = (checkIn.body as SessionBody).data.id;

      const res = await http()
        .post(`/api/v1/parking-sessions/${sessionId}/check-out`)
        .set(auth(userToken))
        .expect(200);

      const { data } = res.body as SessionBody;
      expect(data.status).toBe(SessionStatus.COMPLETED);
      expect(data.checkOutAt).not.toBeNull();

      const after = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: space.id },
      });
      expect(after.status).toBe(SpaceStatus.AVAILABLE);
    });

    it('un usuario no puede liberar la sesión de otro (403)', async () => {
      const space = await resetSpace('E-001');

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(rivalTokens[0]))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      await http()
        .post(
          `/api/v1/parking-sessions/${(checkIn.body as SessionBody).data.id}/check-out`,
        )
        .set(auth(userToken))
        .expect(403);
    });

    it('un ADMIN sí puede liberar administrativamente (pantalla A03)', async () => {
      const space = await resetSpace('E-001');

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(rivalTokens[0]))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      await http()
        .post(
          `/api/v1/parking-sessions/${(checkIn.body as SessionBody).data.id}/check-out`,
        )
        .set(auth(adminToken))
        .expect(200);

      const after = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: space.id },
      });
      expect(after.status).toBe(SpaceStatus.AVAILABLE);
    });

    it('no se puede liberar dos veces la misma sesión', async () => {
      const space = await resetSpace('E-001');

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      const sessionId = (checkIn.body as SessionBody).data.id;
      const url = `/api/v1/parking-sessions/${sessionId}/check-out`;

      await http().post(url).set(auth(userToken)).expect(200);
      await http().post(url).set(auth(userToken)).expect(409);
    });

    it('tras liberar, el puesto vuelve a aparecer en /available', async () => {
      const space = await resetSpace('E-001');

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      const ocupado = await http()
        .get('/api/v1/parking-spaces/available?zoneId=' + space.zoneId)
        .set(auth(userToken))
        .expect(200);
      expect(
        (
          ocupado.body as { data: { spaces: { code: string }[] } }
        ).data.spaces.some((s) => s.code === 'E-001'),
      ).toBe(false);

      await http()
        .post(
          `/api/v1/parking-sessions/${(checkIn.body as SessionBody).data.id}/check-out`,
        )
        .set(auth(userToken))
        .expect(200);

      const libre = await http()
        .get('/api/v1/parking-spaces/available?zoneId=' + space.zoneId)
        .set(auth(userToken))
        .expect(200);
      expect(
        (
          libre.body as { data: { spaces: { code: string }[] } }
        ).data.spaces.some((s) => s.code === 'E-001'),
      ).toBe(true);
    });
  });

  describe('historial', () => {
    it('el historial propio registra entrada y salida', async () => {
      const space = await resetSpace('E-001');

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId: space.id })
        .expect(201);

      await http()
        .post(
          `/api/v1/parking-sessions/${(checkIn.body as SessionBody).data.id}/check-out`,
        )
        .set(auth(userToken))
        .expect(200);

      const res = await http()
        .get('/api/v1/parking-sessions/me/history')
        .set(auth(userToken))
        .expect(200);

      const body = res.body as {
        data: { parkingSpace: { code: string }; checkOutAt: string | null }[];
        meta: { total: number };
      };
      expect(body.meta.total).toBeGreaterThanOrEqual(1);
      expect(body.data[0].parkingSpace.code).toBe('E-001');
      expect(body.data[0].checkOutAt).not.toBeNull();
    });

    it('un USER no puede consultar el historial global (403)', async () => {
      await http()
        .get('/api/v1/parking-sessions')
        .set(auth(userToken))
        .expect(403);
    });

    it('el ADMIN sí puede', async () => {
      await http()
        .get('/api/v1/parking-sessions')
        .set(auth(adminToken))
        .expect(200);
    });
  });
});
