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
  purgeUsers,
  removeTestUsers,
  seedTestUsers,
} from './e2e-helpers';

/**
 * E2E Sprint 10 — dashboard y auditoría.
 * Cubre CU-013, CU-014 y RN-011.
 */
const CODE = 'C-095';
const NEW_USER_EMAIL = 'e2e-audit-nuevo@ujap.edu.ve';

interface Summary {
  data: {
    totalSpaces: number;
    availableSpaces: number;
    occupiedSpaces: number;
    reservedSpaces: number;
    disabledSpaces: number;
    maintenanceSpaces: number;
    occupancyRate: number;
    availableRate: number;
    reservationsToday: number;
    activeSessions: number;
  };
}

interface AuditList {
  data: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    newValue: Record<string, unknown> | null;
    user: { email: string };
  }[];
  meta: { total: number };
}

describe('Dashboard y Auditoría (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const idOf = async (code: string) =>
    (await prisma.parkingSpace.findUniqueOrThrow({ where: { code } })).id;

  const cleanUp = async () => {
    await prisma.auditLog.deleteMany({
      where: { user: { email: { in: [E2E_ADMIN.email, E2E_USER.email] } } },
    });
    await purgeUsers(prisma, { email: { in: [NEW_USER_EMAIL] } });
    await prisma.parkingSpace.updateMany({
      where: { code: CODE },
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

  describe('CU-013 — dashboard', () => {
    it('devuelve todos los KPIs de la sección 22', async () => {
      const res = await http()
        .get('/api/v1/dashboard/summary')
        .set(auth(adminToken))
        .expect(200);

      const { data } = res.body as Summary;

      for (const key of [
        'totalSpaces',
        'availableSpaces',
        'occupiedSpaces',
        'reservedSpaces',
        'disabledSpaces',
        'maintenanceSpaces',
        'occupancyRate',
        'availableRate',
        'reservationsToday',
        'activeSessions',
      ]) {
        expect(typeof data[key as keyof typeof data]).toBe('number');
      }

      expect(data.totalSpaces).toBeGreaterThanOrEqual(1000);
    });

    it('el desglose por estado suma el total', async () => {
      const res = await http()
        .get('/api/v1/dashboard/summary')
        .set(auth(adminToken))
        .expect(200);

      const { data } = res.body as Summary;
      const suma =
        data.availableSpaces +
        data.occupiedSpaces +
        data.reservedSpaces +
        data.disabledSpaces +
        data.maintenanceSpaces;

      expect(suma).toBe(data.totalSpaces);
    });

    it('el desglose por zona coincide con el total general', async () => {
      const [summary, zones] = await Promise.all([
        http().get('/api/v1/dashboard/summary').set(auth(adminToken)),
        http().get('/api/v1/dashboard/zones').set(auth(adminToken)),
      ]);

      const total = (summary.body as Summary).data.totalSpaces;
      const porZona = (
        zones.body as { data: { totalSpaces: number }[] }
      ).data.reduce((sum, z) => sum + z.totalSpaces, 0);

      expect(porZona).toBe(total);
    });

    it('la serie horaria trae 24 franjas fijas', async () => {
      const res = await http()
        .get('/api/v1/dashboard/occupancy')
        .set(auth(adminToken))
        .expect(200);

      const { data } = res.body as {
        data: { buckets: { hour: string; checkIns: number }[] };
      };
      // Fijas para que el gráfico no salte las horas sin actividad
      expect(data.buckets).toHaveLength(24);
    });

    it('un USER no puede ver el dashboard (sección 7.1)', async () => {
      await http()
        .get('/api/v1/dashboard/summary')
        .set(auth(userToken))
        .expect(403);
    });
  });

  describe('RN-011 — toda acción administrativa deja rastro', () => {
    it('deshabilitar un puesto queda auditado con quién y qué', async () => {
      const parkingSpaceId = await idOf(CODE);

      await http()
        .delete(`/api/v1/parking-spaces/${parkingSpaceId}`)
        .set(auth(adminToken))
        .expect(200);

      const res = await http()
        .get('/api/v1/audit-logs?entityType=parking-spaces')
        .set(auth(adminToken))
        .expect(200);

      const { data } = res.body as AuditList;
      const entry = data.find((e) => e.entityId === parkingSpaceId);

      expect(entry).toBeDefined();
      expect(entry!.action).toBe('SPACE_DISABLED');
      expect(entry!.user.email).toBe(E2E_ADMIN.email);
    });

    it('la sub-acción de la ruta da el nombre: RESERVATION_CANCEL', async () => {
      const parkingSpaceId = await idOf(CODE);
      await prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.AVAILABLE },
      });

      const start = new Date();
      start.setDate(start.getDate() + 60);

      const reserva = await http()
        .post('/api/v1/reservations')
        .set(auth(adminToken))
        .send({
          parkingSpaceId,
          title: 'Para auditar',
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 3_600_000).toISOString(),
        })
        .expect(201);

      const id = (reserva.body as { data: { id: string } }).data.id;

      await http()
        .post(`/api/v1/reservations/${id}/cancel`)
        .set(auth(adminToken))
        .expect(200);

      const res = await http()
        .get('/api/v1/audit-logs?entityType=reservations')
        .set(auth(adminToken))
        .expect(200);

      const acciones = (res.body as AuditList).data.map((e) => e.action);
      expect(acciones).toContain('RESERVATION_CREATED');
      expect(acciones).toContain('RESERVATION_CANCEL');

      await prisma.reservation.deleteMany({ where: { parkingSpaceId } });
    });

    it('las lecturas NO se auditan', async () => {
      await http()
        .get('/api/v1/parking-spaces/map')
        .set(auth(adminToken))
        .expect(200);

      const res = await http()
        .get('/api/v1/audit-logs')
        .set(auth(adminToken))
        .expect(200);

      const { data } = res.body as AuditList;
      // Auditar cada consulta multiplicaría las filas sin aportar nada
      expect(data.every((e) => !e.action.includes('GET'))).toBe(true);
    });
  });

  describe('sección 32 — nunca se registran credenciales', () => {
    it('crear un usuario audita la acción pero oculta la contraseña', async () => {
      await http()
        .post('/api/v1/users')
        .set(auth(adminToken))
        .send({
          firstName: 'Auditado',
          lastName: 'Nuevo',
          email: NEW_USER_EMAIL,
          password: 'SuperSecreta123',
          category: 'STUDENT',
        })
        .expect(201);

      const res = await http()
        .get('/api/v1/audit-logs?entityType=users')
        .set(auth(adminToken))
        .expect(200);

      const entry = (res.body as AuditList).data.find(
        (e) => e.action === 'USER_CREATED',
      );

      expect(entry).toBeDefined();
      expect(entry!.newValue?.email).toBe(NEW_USER_EMAIL);
      expect(entry!.newValue?.password).toBe('[oculto]');

      // La contraseña no debe aparecer en ninguna parte del registro
      expect(JSON.stringify(entry)).not.toContain('SuperSecreta123');
    });

    it('el login no se audita en absoluto', async () => {
      await loginAs(app, E2E_ADMIN);

      const res = await http()
        .get('/api/v1/audit-logs?entityType=auth')
        .set(auth(adminToken))
        .expect(200);

      expect((res.body as AuditList).meta.total).toBe(0);
    });
  });

  describe('CU-014 — consulta de auditoría', () => {
    it('filtra por acción y por entidad', async () => {
      const parkingSpaceId = await idOf(CODE);

      await http()
        .delete(`/api/v1/parking-spaces/${parkingSpaceId}`)
        .set(auth(adminToken))
        .expect(200);

      const res = await http()
        .get(
          `/api/v1/audit-logs?action=SPACE_DISABLED&entityId=${parkingSpaceId}`,
        )
        .set(auth(adminToken))
        .expect(200);

      expect((res.body as AuditList).meta.total).toBeGreaterThanOrEqual(1);
    });

    it('expone las acciones registradas para poblar el filtro', async () => {
      const parkingSpaceId = await idOf(CODE);
      await http()
        .delete(`/api/v1/parking-spaces/${parkingSpaceId}`)
        .set(auth(adminToken))
        .expect(200);

      const res = await http()
        .get('/api/v1/audit-logs/actions')
        .set(auth(adminToken))
        .expect(200);

      expect((res.body as { data: string[] }).data).toContain('SPACE_DISABLED');
    });

    it('un USER no puede consultar la auditoría', async () => {
      await http().get('/api/v1/audit-logs').set(auth(userToken)).expect(403);
    });

    it('la auditoría es de solo lectura: no hay forma de borrarla', async () => {
      const parkingSpaceId = await idOf(CODE);
      await http()
        .delete(`/api/v1/parking-spaces/${parkingSpaceId}`)
        .set(auth(adminToken))
        .expect(200);

      const res = await http()
        .get('/api/v1/audit-logs')
        .set(auth(adminToken))
        .expect(200);

      const id = (res.body as AuditList).data[0].id;

      // Un registro de auditoría que se puede borrar no sirve como tal
      await http()
        .delete(`/api/v1/audit-logs/${id}`)
        .set(auth(adminToken))
        .expect(404);
    });
  });
});
