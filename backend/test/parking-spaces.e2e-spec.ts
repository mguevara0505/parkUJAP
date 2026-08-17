import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { SpaceStatus } from '@prisma/client';
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
 * E2E Sprint 3 — Puestos.
 * Requiere el seed aplicado (npm run seed): usa las zonas A..J.
 */
const TEST_ZONE = 'E2E-SP';
const TEST_LOT = 'E2E-SPLOT';

interface MapBody {
  data: {
    total: number;
    bounds: { width: number; height: number };
    zones: { id: string; code: string }[];
    spaces: {
      code: string;
      status: string;
      positionX: number;
      width: number;
    }[];
  };
}

interface AvailableBody {
  data: { total: number; spaces: { code: string; priority: number }[] };
}

describe('Parking Spaces (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asUser = () => ({ Authorization: `Bearer ${userToken}` });
  const get = (url: string) => request(app.getHttpServer()).get(url);

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedTestUsers(prisma);

    adminToken = await loginAs(app, E2E_ADMIN);
    userToken = await loginAs(app, E2E_USER);
  });

  afterAll(async () => {
    await prisma.parkingSpace.deleteMany({
      where: { code: { startsWith: TEST_ZONE } },
    });
    await prisma.parkingZone.deleteMany({
      where: { code: { startsWith: TEST_ZONE } },
    });
    await prisma.parkingLot.deleteMany({ where: { code: TEST_LOT } });
    await removeTestUsers(prisma);
    await app.close();
  });

  describe('rutas literales antes de :id', () => {
    // Si ':id' capturara "map" o "available", ParseUUIDPipe devolvería 400
    it('GET /map responde 200, no 400', async () => {
      const res = await get('/api/v1/parking-spaces/map')
        .set(asUser())
        .expect(200);

      const { data } = res.body as MapBody;
      expect(data.total).toBeGreaterThanOrEqual(1000);
      expect(data.zones.length).toBeGreaterThanOrEqual(10);
    });

    it('GET /available responde 200, no 400', async () => {
      await get('/api/v1/parking-spaces/available').set(asUser()).expect(200);
    });

    it('GET /code/A-001 encuentra el puesto por código', async () => {
      const res = await get('/api/v1/parking-spaces/code/A-001')
        .set(asUser())
        .expect(200);

      const { data } = res.body as { data: { code: string } };
      expect(data.code).toBe('A-001');
    });
  });

  describe('mapa', () => {
    it('devuelve exactamente los campos para dibujar, sin relaciones (§19, §46)', async () => {
      const res = await get('/api/v1/parking-spaces/map')
        .set(asUser())
        .expect(200);

      const { data } = res.body as MapBody;

      // Ni un campo de menos (rompería el dibujo) ni uno de más (peso inútil
      // multiplicado por ~1.000 registros)
      expect(Object.keys(data.spaces[0]).sort()).toEqual(
        [
          'code',
          'height',
          'id',
          'isAccessible',
          'isCovered',
          'positionX',
          'positionY',
          'priority',
          'rotation',
          'status',
          'type',
          'width',
          'zoneId',
        ].sort(),
      );

      expect(data.bounds.width).toBeGreaterThan(0);
      expect(data.bounds.height).toBeGreaterThan(0);
    });
  });

  describe('escritura restringida a ADMIN', () => {
    it('USER no puede deshabilitar un puesto (403)', async () => {
      const space = await prisma.parkingSpace.findUnique({
        where: { code: 'B-001' },
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/parking-spaces/${space!.id}`)
        .set(asUser())
        .expect(403);

      const after = await prisma.parkingSpace.findUnique({
        where: { code: 'B-001' },
      });
      expect(after!.status).toBe(SpaceStatus.AVAILABLE);
    });

    it('rechaza un código de puesto duplicado con 409', async () => {
      const zone = await prisma.parkingZone.findUnique({
        where: { code: 'A' },
      });

      await request(app.getHttpServer())
        .post('/api/v1/parking-spaces')
        .set(asAdmin())
        .send({ zoneId: zone!.id, code: 'A-001', number: 999 })
        .expect(409);
    });

    it('rechaza un puesto en una zona inexistente (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/parking-spaces')
        .set(asAdmin())
        .send({
          zoneId: '00000000-0000-4000-8000-000000000000',
          code: `${TEST_ZONE}-999`,
          number: 999,
        })
        .expect(404);
    });
  });

  describe('estados del puesto (sección 9)', () => {
    let spaceId: string;

    beforeAll(async () => {
      const space = await prisma.parkingSpace.findUnique({
        where: { code: 'C-050' },
      });
      spaceId = space!.id;
    });

    afterAll(async () => {
      await prisma.parkingSpace.update({
        where: { id: spaceId },
        data: { status: SpaceStatus.AVAILABLE },
      });
    });

    const patch = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .patch(`/api/v1/parking-spaces/${spaceId}`)
        .set(asAdmin())
        .send(body);

    it('RN-001: un ADMIN no puede fijar OCCUPIED a mano', async () => {
      await patch({ status: 'OCCUPIED' }).expect(400);

      const after = await prisma.parkingSpace.findUnique({
        where: { id: spaceId },
      });
      expect(after!.status).not.toBe(SpaceStatus.OCCUPIED);
    });

    it('un ADMIN no puede fijar RESERVED a mano', async () => {
      await patch({ status: 'RESERVED' }).expect(400);
    });

    it('RN-004: un puesto en MAINTENANCE desaparece de /available', async () => {
      await patch({ status: 'MAINTENANCE' }).expect(200);

      const res = await get('/api/v1/parking-spaces/available')
        .set(asUser())
        .expect(200);

      const { data } = res.body as AvailableBody;
      expect(data.spaces.some((s) => s.code === 'C-050')).toBe(false);
    });

    it('RN-003: DELETE deshabilita sin borrar y excluye de /available', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/parking-spaces/${spaceId}`)
        .set(asAdmin())
        .expect(200);

      const after = await prisma.parkingSpace.findUnique({
        where: { id: spaceId },
      });
      expect(after).not.toBeNull();
      expect(after!.status).toBe(SpaceStatus.DISABLED);

      const res = await get('/api/v1/parking-spaces/available')
        .set(asUser())
        .expect(200);

      const { data } = res.body as AvailableBody;
      expect(data.spaces.some((s) => s.code === 'C-050')).toBe(false);
    });
  });

  describe('disponibilidad y estructura desactivada', () => {
    it('ordena por prioridad: los mejores puestos primero (sección 17)', async () => {
      const res = await get('/api/v1/parking-spaces/available')
        .set(asUser())
        .expect(200);

      const { data } = res.body as AvailableBody;
      const priorities = data.spaces.map((s) => s.priority);
      expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    });

    it('los puestos de una zona desactivada no se ofrecen como disponibles', async () => {
      const lot = await prisma.parkingLot.create({
        data: { name: 'Lote E2E puestos', code: TEST_LOT },
      });
      const zone = await prisma.parkingZone.create({
        data: { parkingLotId: lot.id, name: 'Zona E2E', code: TEST_ZONE },
      });
      await prisma.parkingSpace.create({
        data: { zoneId: zone.id, code: `${TEST_ZONE}-001`, number: 1 },
      });

      const visible = await get('/api/v1/parking-spaces/available')
        .set(asUser())
        .expect(200);
      expect(
        (visible.body as AvailableBody).data.spaces.some(
          (s) => s.code === `${TEST_ZONE}-001`,
        ),
      ).toBe(true);

      // Al desactivar la zona, su puesto deja de ofrecerse aunque siga AVAILABLE
      await prisma.parkingZone.update({
        where: { id: zone.id },
        data: { isActive: false },
      });

      const hidden = await get('/api/v1/parking-spaces/available')
        .set(asUser())
        .expect(200);
      expect(
        (hidden.body as AvailableBody).data.spaces.some(
          (s) => s.code === `${TEST_ZONE}-001`,
        ),
      ).toBe(false);

      const stillAvailable = await prisma.parkingSpace.findUnique({
        where: { code: `${TEST_ZONE}-001` },
      });
      expect(stillAvailable!.status).toBe(SpaceStatus.AVAILABLE);
    });

    it('lo mismo al desactivar el estacionamiento completo', async () => {
      await prisma.parkingZone.updateMany({
        where: { code: TEST_ZONE },
        data: { isActive: true },
      });
      await prisma.parkingLot.updateMany({
        where: { code: TEST_LOT },
        data: { isActive: false },
      });

      const res = await get('/api/v1/parking-spaces/available')
        .set(asUser())
        .expect(200);

      expect(
        (res.body as AvailableBody).data.spaces.some(
          (s) => s.code === `${TEST_ZONE}-001`,
        ),
      ).toBe(false);
    });
  });
});
