import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ReservationStatus, SpaceStatus } from '@prisma/client';
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
 * E2E Sprint 8 — visitantes y eventos.
 * Cubre CU-008 y el flujo completo de la sección 16 (acto de graduación).
 */
const DOC_PREFIX = 'E2EV-';
const CODES = ['H-001', 'H-002'];

interface VisitorBody {
  data: {
    id: string;
    firstName: string;
    lastName: string;
    documentId: string | null;
    vehiclePlate: string | null;
    reservations?: { id: string; title: string }[];
  };
}

describe('Visitors (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const createVisitor = (body: Record<string, unknown>) =>
    http().post('/api/v1/visitors').set(auth(adminToken)).send(body);

  const cleanUp = async () => {
    const spaces = await prisma.parkingSpace.findMany({
      where: { code: { in: CODES } },
      select: { id: true },
    });
    const ids = spaces.map((s) => s.id);

    await prisma.reservation.deleteMany({
      where: { parkingSpaceId: { in: ids } },
    });
    await prisma.visitor.deleteMany({
      where: { documentId: { startsWith: DOC_PREFIX } },
    });
    await prisma.visitor.deleteMany({ where: { lastName: 'E2EVisitante' } });
    await prisma.parkingSpace.updateMany({
      where: { id: { in: ids } },
      data: { status: SpaceStatus.AVAILABLE },
    });
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedTestUsers(prisma);
    adminToken = await loginAs(app, E2E_ADMIN);
    userToken = await loginAs(app, E2E_USER);
  });

  afterAll(async () => {
    await cleanUp();
    await removeTestUsers(prisma);
    await app.close();
  });

  beforeEach(cleanUp);

  describe('CU-008 — crear visitante', () => {
    it('el ADMIN crea un visitante con su vehículo', async () => {
      const res = await createVisitor({
        firstName: 'Juan',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}001`,
        organization: 'Universidad de Carabobo',
        vehiclePlate: 'abc123',
        vehicleBrand: 'Toyota',
        vehicleModel: 'Corolla',
        vehicleColor: 'Gris',
      }).expect(201);

      const { data } = res.body as VisitorBody;
      // La placa se normaliza a mayúsculas para que la búsqueda sea fiable
      expect(data.vehiclePlate).toBe('ABC123');
      expect(data.documentId).toBe(`${DOC_PREFIX}001`);
    });

    it('rechaza un documento duplicado con 409', async () => {
      await createVisitor({
        firstName: 'Juan',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}002`,
      }).expect(201);

      const res = await createVisitor({
        firstName: 'Otro',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}002`,
      }).expect(409);

      expect((res.body as { code: string }).code).toBe(
        'UNIQUE_CONSTRAINT_VIOLATION',
      );
    });

    it('permite varios visitantes sin documento', async () => {
      await createVisitor({
        firstName: 'Sin',
        lastName: 'E2EVisitante',
      }).expect(201);

      // Varios NULL no colisionan en un índice único de PostgreSQL
      await createVisitor({
        firstName: 'Documento',
        lastName: 'E2EVisitante',
      }).expect(201);

      expect(
        await prisma.visitor.count({ where: { lastName: 'E2EVisitante' } }),
      ).toBe(2);
    });

    it('un USER no puede crear visitantes (sección 7.1)', async () => {
      await http()
        .post('/api/v1/visitors')
        .set(auth(userToken))
        .send({ firstName: 'No', lastName: 'E2EVisitante' })
        .expect(403);
    });
  });

  describe('búsqueda (pantalla A05)', () => {
    beforeEach(async () => {
      await createVisitor({
        firstName: 'Ana',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}100`,
        organization: 'Ministerio de Educación',
        vehiclePlate: 'XYZ789',
      }).expect(201);
    });

    it.each([
      ['nombre', 'Ana'],
      ['cédula', `${DOC_PREFIX}100`],
      ['placa', 'XYZ789'],
      ['institución', 'Ministerio'],
    ])('encuentra al visitante por %s', async (_campo, term) => {
      const res = await http()
        .get(`/api/v1/visitors?search=${encodeURIComponent(term)}`)
        .set(auth(adminToken))
        .expect(200);

      expect((res.body as { meta: { total: number } }).meta.total).toBe(1);
    });
  });

  describe('sección 16 — flujo completo del acto de graduación', () => {
    it('visitante → vehículo → mejor puesto → reserva → historial', async () => {
      // 1. Crear visitante con su vehículo
      const visitor = await createVisitor({
        firstName: 'Juan',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}200`,
        organization: 'Universidad de Carabobo',
        vehiclePlate: 'ABC123',
        vehicleBrand: 'Toyota',
        vehicleModel: 'Corolla',
      }).expect(201);

      const visitorId = (visitor.body as VisitorBody).data.id;

      // 2. Elegir uno de los mejores puestos disponibles (sección 17)
      const best = await http()
        .get('/api/v1/parking-spaces/available?maxPriority=1')
        .set(auth(adminToken))
        .expect(200);

      const spaces = (
        best.body as { data: { spaces: { id: string; priority: number }[] } }
      ).data.spaces;
      expect(spaces.length).toBeGreaterThan(0);
      expect(spaces[0].priority).toBe(1);

      const parkingSpaceId = (
        await prisma.parkingSpace.findUniqueOrThrow({
          where: { code: 'H-001' },
        })
      ).id;

      // 3. Crear la reserva del evento a nombre del visitante
      const start = new Date();
      start.setDate(start.getDate() + 30);
      start.setHours(8, 0, 0, 0);
      const end = new Date(start);
      end.setHours(14, 0, 0, 0);

      const reservation = await http()
        .post('/api/v1/reservations')
        .set(auth(adminToken))
        .send({
          parkingSpaceId,
          visitorId,
          title: 'Acto de graduación',
          reservationType: 'EVENT',
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          vehiclePlate: 'ABC123',
        })
        .expect(201);

      const created = reservation.body as {
        data: { visitor: { id: string } | null; status: ReservationStatus };
      };
      expect(created.data.visitor?.id).toBe(visitorId);
      expect(created.data.status).toBe(ReservationStatus.CONFIRMED);

      // 4. El historial del visitante muestra la reserva
      const detail = await http()
        .get(`/api/v1/visitors/${visitorId}`)
        .set(auth(adminToken))
        .expect(200);

      const { data } = detail.body as VisitorBody;
      expect(data.reservations).toHaveLength(1);
      expect(data.reservations?.[0].title).toBe('Acto de graduación');
    });

    it('rechaza una reserva con visitante inexistente (404)', async () => {
      const parkingSpaceId = (
        await prisma.parkingSpace.findUniqueOrThrow({
          where: { code: 'H-002' },
        })
      ).id;

      const start = new Date();
      start.setDate(start.getDate() + 30);

      const res = await http()
        .post('/api/v1/reservations')
        .set(auth(adminToken))
        .send({
          parkingSpaceId,
          visitorId: '00000000-0000-4000-8000-000000000000',
          title: 'Visitante fantasma',
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 3_600_000).toISOString(),
        })
        .expect(404);

      expect((res.body as { message: string }).message).toContain('Visitante');
    });
  });

  describe('eliminación', () => {
    it('elimina un visitante sin historial', async () => {
      const visitor = await createVisitor({
        firstName: 'Efímero',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}300`,
      }).expect(201);

      await http()
        .delete(`/api/v1/visitors/${(visitor.body as VisitorBody).data.id}`)
        .set(auth(adminToken))
        .expect(200);

      expect(
        await prisma.visitor.count({
          where: { documentId: `${DOC_PREFIX}300` },
        }),
      ).toBe(0);
    });

    it('se niega a eliminar un visitante con reservas: el historial se conserva', async () => {
      const visitor = await createVisitor({
        firstName: 'Con',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}400`,
      }).expect(201);

      const visitorId = (visitor.body as VisitorBody).data.id;
      const parkingSpaceId = (
        await prisma.parkingSpace.findUniqueOrThrow({
          where: { code: 'H-002' },
        })
      ).id;

      const start = new Date();
      start.setDate(start.getDate() + 40);

      await http()
        .post('/api/v1/reservations')
        .set(auth(adminToken))
        .send({
          parkingSpaceId,
          visitorId,
          title: 'Con historial',
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 3_600_000).toISOString(),
        })
        .expect(201);

      const res = await http()
        .delete(`/api/v1/visitors/${visitorId}`)
        .set(auth(adminToken))
        .expect(409);

      expect((res.body as { code: string }).code).toBe(
        'VISITOR_HAS_RESERVATIONS',
      );

      // Sigue existiendo: no se perdió la trazabilidad
      expect(await prisma.visitor.count({ where: { id: visitorId } })).toBe(1);
    });
  });

  describe('actualización', () => {
    it('registra el vehículo de un visitante creado sin él', async () => {
      const visitor = await createVisitor({
        firstName: 'Aún',
        lastName: 'E2EVisitante',
        documentId: `${DOC_PREFIX}500`,
      }).expect(201);

      const res = await http()
        .patch(`/api/v1/visitors/${(visitor.body as VisitorBody).data.id}`)
        .set(auth(adminToken))
        .send({ vehiclePlate: 'def456', vehicleBrand: 'Ford' })
        .expect(200);

      expect((res.body as VisitorBody).data.vehiclePlate).toBe('DEF456');
    });
  });
});
