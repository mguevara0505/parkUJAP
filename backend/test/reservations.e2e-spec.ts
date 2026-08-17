import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ReservationStatus, SpaceStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { ReservationsScheduler } from '../src/modules/reservations/reservations.scheduler';
import {
  E2E_ADMIN,
  E2E_USER,
  createTestApp,
  loginAs,
  removeTestUsers,
  seedTestUsers,
} from './e2e-helpers';

/**
 * E2E Sprint 7 — reservas administrativas.
 * Cubre E2E-006 y E2E-007, RN-005, RN-006, RN-007, RN-008 y la política de
 * la sección 44.
 */
const CODES = ['D-001', 'D-002', 'D-003', 'D-004'];

/** Fechas relativas para no depender del reloj: base = mañana a las 08:00. */
const base = new Date();
base.setDate(base.getDate() + 1);
base.setHours(8, 0, 0, 0);

const at = (hoursFromBase: number) =>
  new Date(base.getTime() + hoursFromBase * 3_600_000).toISOString();

interface ReservationBody {
  data: {
    id: string;
    status: ReservationStatus;
    parkingSpace: { code: string };
  };
}

describe('Reservations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let scheduler: ReservationsScheduler;
  let adminToken: string;
  let userToken: string;
  let userId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const spaceIdOf = async (code: string) =>
    (await prisma.parkingSpace.findUniqueOrThrow({ where: { code } })).id;

  const reserve = (body: Record<string, unknown>) =>
    http().post('/api/v1/reservations').set(auth(adminToken)).send(body);

  const cleanUp = async () => {
    const spaces = await prisma.parkingSpace.findMany({
      where: { code: { in: CODES } },
      select: { id: true },
    });
    const ids = spaces.map((s) => s.id);
    await prisma.parkingSession.deleteMany({
      where: { parkingSpaceId: { in: ids } },
    });
    await prisma.reservation.deleteMany({
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
    scheduler = app.get(ReservationsScheduler);
    await seedTestUsers(prisma);

    adminToken = await loginAs(app, E2E_ADMIN);
    userToken = await loginAs(app, E2E_USER);
    userId = (
      await prisma.user.findUniqueOrThrow({ where: { email: E2E_USER.email } })
    ).id;
  });

  afterAll(async () => {
    await cleanUp();
    await removeTestUsers(prisma);
    await app.close();
  });

  beforeEach(cleanUp);

  describe('E2E-006 — crear reserva', () => {
    it('el ADMIN crea una reserva y queda CONFIRMED', async () => {
      const res = await reserve({
        parkingSpaceId: await spaceIdOf('D-001'),
        title: 'Acto de graduación — Prof. Juan Pérez',
        startAt: at(0),
        endAt: at(6),
        reservationType: 'EVENT',
        vehiclePlate: 'ABC123',
      }).expect(201);

      const { data } = res.body as ReservationBody;
      expect(data.status).toBe(ReservationStatus.CONFIRMED);
      expect(data.parkingSpace.code).toBe('D-001');
    });

    it('un USER no puede crear reservas (sección 7.1)', async () => {
      const parkingSpaceId = await spaceIdOf('D-001');

      await http()
        .post('/api/v1/reservations')
        .set(auth(userToken))
        .send({
          parkingSpaceId,
          title: 'Intento no autorizado',
          startAt: at(0),
          endAt: at(2),
        })
        .expect(403);

      // Acotado al puesto de la prueba: la base puede tener otras reservas
      expect(
        await prisma.reservation.count({ where: { parkingSpaceId } }),
      ).toBe(0);
    });

    it('rechaza un rango invertido', async () => {
      await reserve({
        parkingSpaceId: await spaceIdOf('D-001'),
        title: 'Rango inválido',
        startAt: at(6),
        endAt: at(2),
      }).expect(409);
    });

    it('rechaza un puesto inexistente con 404', async () => {
      await reserve({
        parkingSpaceId: '00000000-0000-4000-8000-000000000000',
        title: 'Puesto fantasma',
        startAt: at(0),
        endAt: at(2),
      }).expect(404);
    });
  });

  describe('RN-006 y política de la sección 44', () => {
    it('rechaza reservas solapadas: 08:00-10:00 y 09:00-11:00', async () => {
      const parkingSpaceId = await spaceIdOf('D-002');

      await reserve({
        parkingSpaceId,
        title: 'Primera',
        startAt: at(0),
        endAt: at(2),
      }).expect(201);

      const res = await reserve({
        parkingSpaceId,
        title: 'Solapada',
        startAt: at(1),
        endAt: at(3),
      }).expect(409);

      const body = res.body as { code: string; message: string };
      expect(body.code).toBe('RESERVATION_OVERLAP');
      // El mensaje debe decir con qué reserva chocó
      expect(body.message).toContain('Primera');

      expect(
        await prisma.reservation.count({ where: { parkingSpaceId } }),
      ).toBe(1);
    });

    it('permite reservas consecutivas: 08:00-10:00 y 10:00-12:00', async () => {
      const parkingSpaceId = await spaceIdOf('D-002');

      await reserve({
        parkingSpaceId,
        title: 'Primera',
        startAt: at(0),
        endAt: at(2),
      }).expect(201);

      await reserve({
        parkingSpaceId,
        title: 'Consecutiva',
        startAt: at(2),
        endAt: at(4),
      }).expect(201);

      expect(
        await prisma.reservation.count({ where: { parkingSpaceId } }),
      ).toBe(2);
    });

    it('una reserva cancelada libera el intervalo (RN-007)', async () => {
      const parkingSpaceId = await spaceIdOf('D-002');

      const first = await reserve({
        parkingSpaceId,
        title: 'Se cancelará',
        startAt: at(0),
        endAt: at(2),
      }).expect(201);

      await reserve({
        parkingSpaceId,
        title: 'Choca',
        startAt: at(0),
        endAt: at(2),
      }).expect(409);

      await http()
        .post(
          `/api/v1/reservations/${(first.body as ReservationBody).data.id}/cancel`,
        )
        .set(auth(adminToken))
        .expect(200);

      // Ahora sí cabe otra en el mismo horario
      await reserve({
        parkingSpaceId,
        title: 'Ahora sí',
        startAt: at(0),
        endAt: at(2),
      }).expect(201);
    });

    it('la restricción vive en la base de datos, no en el servicio', async () => {
      const parkingSpaceId = await spaceIdOf('D-002');
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: E2E_ADMIN.email },
      });

      await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          title: 'Directa',
          startAt: new Date(at(0)),
          endAt: new Date(at(2)),
          status: ReservationStatus.CONFIRMED,
        },
      });

      // Inserción directa saltándose el servicio: PostgreSQL debe rechazarla
      await expect(
        prisma.reservation.create({
          data: {
            parkingSpaceId,
            createdByAdminId: admin.id,
            title: 'Solapada directa',
            startAt: new Date(at(1)),
            endAt: new Date(at(3)),
            status: ReservationStatus.CONFIRMED,
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('E2E-007 y RN-005 — puesto reservado', () => {
    /** Crea una reserva que ya está vigente ahora mismo. */
    const reserveNow = async (code: string, forUserId?: string) => {
      const parkingSpaceId = await spaceIdOf(code);
      const now = Date.now();

      const res = await reserve({
        parkingSpaceId,
        title: forUserId ? 'Puesto de profesor' : 'Visita institucional',
        startAt: new Date(now - 3_600_000).toISOString(),
        endAt: new Date(now + 3_600_000).toISOString(),
        ...(forUserId && { userId: forUserId }),
      }).expect(201);

      return {
        parkingSpaceId,
        id: (res.body as ReservationBody).data.id,
      };
    };

    it('la reserva vigente deja el puesto en RESERVED', async () => {
      const { parkingSpaceId } = await reserveNow('D-003');

      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: parkingSpaceId },
      });
      expect(space.status).toBe(SpaceStatus.RESERVED);
    });

    it('E2E-007: otro usuario no puede ocupar el puesto reservado', async () => {
      const { parkingSpaceId } = await reserveNow('D-003');

      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId })
        .expect(409);

      expect((res.body as { code: string }).code).toBe(
        'PARKING_SPACE_RESERVED',
      );
    });

    it('RN-005: el titular de la reserva sí puede ocuparlo', async () => {
      const { parkingSpaceId, id } = await reserveNow('D-003', userId);

      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId })
        .expect(201);

      const sessionId = (res.body as { data: { id: string } }).data.id;

      // La sesión queda enlazada a la reserva que la habilitó
      const session = await prisma.parkingSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
      expect(session.reservationId).toBe(id);

      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: parkingSpaceId },
      });
      expect(space.status).toBe(SpaceStatus.OCCUPIED);
    });

    it('RN-015: al liberar, el puesto vuelve a RESERVED, no a AVAILABLE', async () => {
      const { parkingSpaceId } = await reserveNow('D-003', userId);

      const checkIn = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(userToken))
        .send({ parkingSpaceId })
        .expect(201);

      await http()
        .post(
          `/api/v1/parking-sessions/${(checkIn.body as { data: { id: string } }).data.id}/check-out`,
        )
        .set(auth(userToken))
        .expect(200);

      // La reserva sigue vigente: el puesto debe seguir protegido
      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: parkingSpaceId },
      });
      expect(space.status).toBe(SpaceStatus.RESERVED);
    });

    it('al cancelar la reserva vigente, el puesto vuelve a estar disponible', async () => {
      const { parkingSpaceId, id } = await reserveNow('D-003');

      await http()
        .post(`/api/v1/reservations/${id}/cancel`)
        .set(auth(adminToken))
        .expect(200);

      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: parkingSpaceId },
      });
      expect(space.status).toBe(SpaceStatus.AVAILABLE);
    });
  });

  describe('job programado (sección 45)', () => {
    it('activa la reserva cuyo período empezó y protege el puesto', async () => {
      const parkingSpaceId = await spaceIdOf('D-004');
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: E2E_ADMIN.email },
      });

      const reservation = await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          title: 'Empezó hace un rato',
          startAt: new Date(Date.now() - 60_000),
          endAt: new Date(Date.now() + 3_600_000),
          status: ReservationStatus.CONFIRMED,
        },
      });

      await scheduler.tick();

      const after = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      expect(after.status).toBe(ReservationStatus.ACTIVE);

      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: parkingSpaceId },
      });
      expect(space.status).toBe(SpaceStatus.RESERVED);
    });

    it('RN-008: una reserva vencida sin uso pasa a NO_SHOW y libera el puesto', async () => {
      const parkingSpaceId = await spaceIdOf('D-004');
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: E2E_ADMIN.email },
      });

      const reservation = await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          title: 'Nadie llegó',
          startAt: new Date(Date.now() - 7_200_000),
          endAt: new Date(Date.now() - 3_600_000),
          status: ReservationStatus.ACTIVE,
        },
      });
      await prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.RESERVED },
      });

      await scheduler.tick();

      const after = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      expect(after.status).toBe(ReservationStatus.NO_SHOW);

      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: parkingSpaceId },
      });
      expect(space.status).toBe(SpaceStatus.AVAILABLE);
    });

    it('RN-008: si alguien la usó, la reserva vencida pasa a COMPLETED', async () => {
      const parkingSpaceId = await spaceIdOf('D-004');
      const admin = await prisma.user.findUniqueOrThrow({
        where: { email: E2E_ADMIN.email },
      });
      const startAt = new Date(Date.now() - 7_200_000);
      const endAt = new Date(Date.now() - 3_600_000);

      const reservation = await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          title: 'Sí vino',
          startAt,
          endAt,
          status: ReservationStatus.ACTIVE,
        },
      });

      await prisma.parkingSession.create({
        data: {
          userId,
          parkingSpaceId,
          checkInAt: new Date(startAt.getTime() + 600_000),
          checkOutAt: endAt,
          status: 'COMPLETED',
        },
      });

      await scheduler.tick();

      const after = await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
      });
      expect(after.status).toBe(ReservationStatus.COMPLETED);
    });
  });

  describe('listado y filtros (pantalla A04)', () => {
    it('filtra por puesto y por estado', async () => {
      const parkingSpaceId = await spaceIdOf('D-001');

      await reserve({
        parkingSpaceId,
        title: 'Para filtrar',
        startAt: at(0),
        endAt: at(2),
      }).expect(201);

      const res = await http()
        .get(
          `/api/v1/reservations?parkingSpaceId=${parkingSpaceId}&status=CONFIRMED`,
        )
        .set(auth(adminToken))
        .expect(200);

      const body = res.body as { data: unknown[]; meta: { total: number } };
      expect(body.meta.total).toBe(1);
    });

    it('busca por placa del vehículo', async () => {
      await reserve({
        parkingSpaceId: await spaceIdOf('D-001'),
        title: 'Con placa',
        startAt: at(0),
        endAt: at(2),
        vehiclePlate: 'XYZ789',
      }).expect(201);

      const res = await http()
        .get('/api/v1/reservations?search=XYZ789')
        .set(auth(adminToken))
        .expect(200);

      expect((res.body as { meta: { total: number } }).meta.total).toBe(1);
    });

    it('un USER no puede listar reservas', async () => {
      await http().get('/api/v1/reservations').set(auth(userToken)).expect(403);
    });
  });
});
