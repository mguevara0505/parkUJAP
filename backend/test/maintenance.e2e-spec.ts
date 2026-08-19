import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MaintenanceStatus, SpaceStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { MaintenanceScheduler } from '../src/modules/maintenance/maintenance.scheduler';
import {
  E2E_ADMIN,
  E2E_USER,
  createTestApp,
  loginAs,
  removeTestUsers,
  seedTestUsers,
} from './e2e-helpers';

/**
 * E2E Sprint 9 — bloqueos y mantenimiento.
 * Cubre CU-009, CU-010, E2E-008, E2E-010, RN-009 y RN-010.
 */
const CODES = ['D-090', 'D-091', 'D-092'];

const inHours = (h: number) =>
  new Date(Date.now() + h * 3_600_000).toISOString();

interface BlockBody {
  data: {
    id: string;
    status: MaintenanceStatus;
    reason: string;
    parkingSpace: { code: string; status: SpaceStatus };
  };
}

describe('Maintenance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let scheduler: MaintenanceScheduler;
  let adminToken: string;
  let userToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const idOf = async (code: string) =>
    (await prisma.parkingSpace.findUniqueOrThrow({ where: { code } })).id;

  const statusOf = async (code: string) =>
    (await prisma.parkingSpace.findUniqueOrThrow({ where: { code } })).status;

  const block = (body: Record<string, unknown>) =>
    http().post('/api/v1/maintenance-blocks').set(auth(adminToken)).send(body);

  const reset = async () => {
    const spaces = await prisma.parkingSpace.findMany({
      where: { code: { in: CODES } },
      select: { id: true },
    });
    const ids = spaces.map((s) => s.id);

    await prisma.parkingSession.deleteMany({
      where: { parkingSpaceId: { in: ids } },
    });
    await prisma.maintenanceBlock.deleteMany({
      where: { parkingSpaceId: { in: ids } },
    });
    await prisma.parkingSpace.updateMany({
      where: { id: { in: ids } },
      data: { status: SpaceStatus.AVAILABLE },
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    scheduler = app.get(MaintenanceScheduler);
    await seedTestUsers(prisma);
    adminToken = await loginAs(app, E2E_ADMIN);
    userToken = await loginAs(app, E2E_USER);
  });

  afterAll(async () => {
    await reset();
    await removeTestUsers(prisma);
    await app.close();
  });

  beforeEach(reset);

  describe('E2E-008 — bloquear un puesto', () => {
    it('RN-010: un bloqueo inmediato deja el puesto en MAINTENANCE', async () => {
      const res = await block({
        parkingSpaceId: await idOf(CODES[0]),
        reason: 'PAINTING',
        description: 'Repintado de líneas',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      const { data } = res.body as BlockBody;
      expect(data.status).toBe(MaintenanceStatus.ACTIVE);
      expect(await statusOf(CODES[0])).toBe(SpaceStatus.MAINTENANCE);
    });

    it('un bloqueo futuro NO afecta al puesto todavía', async () => {
      const res = await block({
        parkingSpaceId: await idOf(CODES[1]),
        reason: 'CONSTRUCTION',
        startAt: inHours(48),
        endAt: inHours(72),
      }).expect(201);

      expect((res.body as BlockBody).data.status).toBe(
        MaintenanceStatus.SCHEDULED,
      );
      // Bloquear el puesto desde hoy por una obra de pasado mañana sería
      // perder dos días de uso
      expect(await statusOf(CODES[1])).toBe(SpaceStatus.AVAILABLE);
    });

    it('RN-009: rechaza un rango invertido', async () => {
      await block({
        parkingSpaceId: await idOf(CODES[0]),
        reason: 'MAINTENANCE',
        startAt: inHours(8),
        endAt: inHours(2),
      }).expect(409);
    });

    it('rechaza un puesto inexistente con 404', async () => {
      await block({
        parkingSpaceId: '00000000-0000-4000-8000-000000000000',
        reason: 'SECURITY',
        startAt: inHours(1),
        endAt: inHours(2),
      }).expect(404);
    });

    it('un USER no puede bloquear puestos (sección 7.1)', async () => {
      await http()
        .post('/api/v1/maintenance-blocks')
        .set(auth(userToken))
        .send({
          parkingSpaceId: await idOf(CODES[0]),
          reason: 'PAINTING',
          startAt: inHours(1),
          endAt: inHours(2),
        })
        .expect(403);
    });
  });

  describe('E2E-009 — un puesto bloqueado no puede ocuparse', () => {
    it('el check-in sobre un puesto en mantenimiento se rechaza', async () => {
      const parkingSpaceId = await idOf(CODES[0]);

      await block({
        parkingSpaceId,
        reason: 'PAINTING',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId })
        .expect(409);

      expect((res.body as { code: string }).code).toBe(
        'PARKING_SPACE_NOT_AVAILABLE',
      );
    });

    it('tampoco aparece en /available', async () => {
      const parkingSpaceId = await idOf(CODES[0]);
      const zoneId = (
        await prisma.parkingSpace.findUniqueOrThrow({
          where: { id: parkingSpaceId },
        })
      ).zoneId;

      await block({
        parkingSpaceId,
        reason: 'MAINTENANCE',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      const res = await http()
        .get(`/api/v1/parking-spaces/available?zoneId=${zoneId}`)
        .set(auth(userToken))
        .expect(200);

      const { data } = res.body as { data: { spaces: { code: string }[] } };
      expect(data.spaces.some((s) => s.code === CODES[0])).toBe(false);
    });
  });

  describe('E2E-010 — reactivar el puesto', () => {
    it('CU-010: completar el bloqueo devuelve el puesto a AVAILABLE', async () => {
      const res = await block({
        parkingSpaceId: await idOf(CODES[0]),
        reason: 'PAINTING',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      expect(await statusOf(CODES[0])).toBe(SpaceStatus.MAINTENANCE);

      await http()
        .post(
          `/api/v1/maintenance-blocks/${(res.body as BlockBody).data.id}/complete`,
        )
        .set(auth(adminToken))
        .expect(200);

      expect(await statusOf(CODES[0])).toBe(SpaceStatus.AVAILABLE);
    });

    it('cancelar el bloqueo también lo reactiva', async () => {
      const res = await block({
        parkingSpaceId: await idOf(CODES[0]),
        reason: 'SECURITY',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      await http()
        .post(
          `/api/v1/maintenance-blocks/${(res.body as BlockBody).data.id}/cancel`,
        )
        .set(auth(adminToken))
        .expect(200);

      expect(await statusOf(CODES[0])).toBe(SpaceStatus.AVAILABLE);
    });

    it('no se puede cerrar dos veces el mismo bloqueo', async () => {
      const res = await block({
        parkingSpaceId: await idOf(CODES[0]),
        reason: 'OTHER',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      const url = `/api/v1/maintenance-blocks/${(res.body as BlockBody).data.id}/complete`;
      await http().post(url).set(auth(adminToken)).expect(200);
      await http().post(url).set(auth(adminToken)).expect(409);
    });
  });

  describe('job programado (sección 45)', () => {
    it('activa el bloqueo cuyo período empezó y bloquea el puesto', async () => {
      const parkingSpaceId = await idOf(CODES[2]);
      const admin = await prisma.user.findFirstOrThrow({
        where: { email: E2E_ADMIN.email },
      });

      // Creado como programado, pero con inicio ya pasado
      const created = await prisma.maintenanceBlock.create({
        data: {
          parkingSpaceId,
          createdById: admin.id,
          reason: 'CONSTRUCTION',
          startAt: new Date(Date.now() - 60_000),
          endAt: new Date(Date.now() + 3_600_000),
          status: MaintenanceStatus.SCHEDULED,
        },
      });

      await scheduler.tick();

      const after = await prisma.maintenanceBlock.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(after.status).toBe(MaintenanceStatus.ACTIVE);
      expect(await statusOf(CODES[2])).toBe(SpaceStatus.MAINTENANCE);
    });

    it('RN-009: al vencer, el bloqueo se cierra y el puesto vuelve solo', async () => {
      const parkingSpaceId = await idOf(CODES[2]);
      const admin = await prisma.user.findFirstOrThrow({
        where: { email: E2E_ADMIN.email },
      });

      const created = await prisma.maintenanceBlock.create({
        data: {
          parkingSpaceId,
          createdById: admin.id,
          reason: 'PAINTING',
          startAt: new Date(Date.now() - 7_200_000),
          endAt: new Date(Date.now() - 60_000),
          status: MaintenanceStatus.ACTIVE,
        },
      });
      await prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.MAINTENANCE },
      });

      await scheduler.tick();

      const after = await prisma.maintenanceBlock.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(after.status).toBe(MaintenanceStatus.COMPLETED);
      // Ningún puesto se queda fuera de servicio porque nadie lo reactivó
      expect(await statusOf(CODES[2])).toBe(SpaceStatus.AVAILABLE);
    });

    it('no le arrebata el puesto a quien está dentro', async () => {
      const parkingSpaceId = await idOf(CODES[2]);

      // Alguien se estaciona primero
      await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId })
        .expect(201);

      await block({
        parkingSpaceId,
        reason: 'MAINTENANCE',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      // El puesto sigue ocupado: el bloqueo lo recogerá cuando libere
      expect(await statusOf(CODES[2])).toBe(SpaceStatus.OCCUPIED);
    });
  });

  describe('listado (pantalla A06)', () => {
    it('filtra por motivo y por estado', async () => {
      await block({
        parkingSpaceId: await idOf(CODES[0]),
        reason: 'PAINTING',
        startAt: inHours(-0.5),
        endAt: inHours(4),
      }).expect(201);

      const res = await http()
        .get('/api/v1/maintenance-blocks?reason=PAINTING&status=ACTIVE')
        .set(auth(adminToken))
        .expect(200);

      const body = res.body as { meta: { total: number } };
      expect(body.meta.total).toBeGreaterThanOrEqual(1);
    });

    it('un USER no puede consultar los bloqueos', async () => {
      await http()
        .get('/api/v1/maintenance-blocks')
        .set(auth(userToken))
        .expect(403);
    });
  });
});
