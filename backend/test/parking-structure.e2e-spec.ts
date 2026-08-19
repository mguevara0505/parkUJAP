import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
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
 * E2E Sprint 2 — Estacionamientos y zonas.
 * Verifica la separación de permisos de las secciones 7.1 / 7.2:
 * lectura para cualquier autenticado, escritura solo ADMIN.
 */
const LOT_CODE = 'E2E-LOT';
const ZONE_CODE = 'E2E-ZN';

interface Body<T> {
  data: T;
}
interface Entity {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

describe('Parking Lots & Zones (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let lotId: string;

  const asAdmin = () => ({ Authorization: `Bearer ${adminToken}` });
  const asUser = () => ({ Authorization: `Bearer ${userToken}` });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await seedTestUsers(prisma);

    adminToken = await loginAs(app, E2E_ADMIN);
    userToken = await loginAs(app, E2E_USER);
  });

  afterAll(async () => {
    // Las zonas primero: dependen del estacionamiento por clave ajena
    await prisma.parkingZone.deleteMany({
      where: { code: { startsWith: ZONE_CODE } },
    });
    await prisma.parkingLot.deleteMany({ where: { code: LOT_CODE } });
    await removeTestUsers(prisma);
    await app.close();
  });

  describe('escritura restringida a ADMIN', () => {
    it('USER no puede crear un estacionamiento (403)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/parking-lots')
        .set(asUser())
        .send({ name: 'Intento no autorizado', code: 'E2E-NOPE' })
        .expect(403);

      const created = await prisma.parkingLot.findUnique({
        where: { code: 'E2E-NOPE' },
      });
      expect(created).toBeNull();
    });

    it('ADMIN crea un estacionamiento', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parking-lots')
        .set(asAdmin())
        .send({
          name: 'Estacionamiento E2E',
          code: LOT_CODE,
          location: 'Zona de pruebas',
        })
        .expect(201);

      const lot = (res.body as Body<Entity>).data;
      expect(lot.code).toBe(LOT_CODE);
      expect(lot.isActive).toBe(true);
      lotId = lot.id;
    });

    it('rechaza un código duplicado con 409 y nombra el campo en conflicto', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parking-lots')
        .set(asAdmin())
        .send({ name: 'Duplicado', code: LOT_CODE })
        .expect(409);

      const body = res.body as { code: string; message: string };
      expect(body.code).toBe('UNIQUE_CONSTRAINT_VIOLATION');
      // El mensaje llega al usuario final: debe decir qué campo falló
      expect(body.message).toContain('code');
      expect(body.message).not.toContain('undefined');
    });

    it('rechaza un código con formato inválido (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/parking-lots')
        .set(asAdmin())
        .send({ name: 'Código inválido', code: 'minúsculas y espacios' })
        .expect(400);
    });
  });

  describe('lectura para cualquier autenticado', () => {
    it('USER puede listar estacionamientos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parking-lots')
        .set(asUser())
        .expect(200);

      const body = res.body as { data: Entity[]; meta: { total: number } };
      expect(body.meta.total).toBeGreaterThan(0);
    });

    it('sin token retorna 401', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/parking-lots')
        .expect(401);
    });

    it('el seed dejó las 10 zonas del Documento Maestro (sección 27)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/parking-zones?limit=100')
        .set(asUser())
        .expect(200);

      const body = res.body as { data: { code: string }[] };
      const codes = body.data.map((z) => z.code);

      for (const expected of 'ABCDEFGHIJ'.split('')) {
        expect(codes).toContain(expected);
      }
    });
  });

  describe('zonas', () => {
    it('rechaza una zona cuyo estacionamiento no existe (404)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/parking-zones')
        .set(asAdmin())
        .send({
          parkingLotId: '00000000-0000-4000-8000-000000000000',
          name: 'Zona huérfana',
          code: `${ZONE_CODE}-X`,
        })
        .expect(404);
    });

    it('ADMIN crea una zona y queda asociada al estacionamiento', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parking-zones')
        .set(asAdmin())
        .send({
          parkingLotId: lotId,
          name: 'Zona E2E',
          code: `${ZONE_CODE}-1`,
          sortOrder: 1,
        })
        .expect(201);

      const zone = (res.body as Body<{ parkingLotId: string }>).data;
      expect(zone.parkingLotId).toBe(lotId);

      // El detalle del estacionamiento la incluye
      const detail = await request(app.getHttpServer())
        .get(`/api/v1/parking-lots/${lotId}`)
        .set(asUser())
        .expect(200);

      const lot = (detail.body as Body<{ zones: { code: string }[] }>).data;
      expect(lot.zones.map((z) => z.code)).toContain(`${ZONE_CODE}-1`);
    });

    it('filtra zonas por estacionamiento', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/parking-zones?parkingLotId=${lotId}`)
        .set(asUser())
        .expect(200);

      const body = res.body as { data: { parkingLotId: string }[] };
      expect(body.data).toHaveLength(1);
      expect(body.data[0].parkingLotId).toBe(lotId);
    });

    it('DELETE desactiva en lugar de borrar (soft-delete)', async () => {
      const zone = await prisma.parkingZone.findUnique({
        where: { code: `${ZONE_CODE}-1` },
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/parking-zones/${zone!.id}`)
        .set(asAdmin())
        .expect(200);

      const afterDelete = await prisma.parkingZone.findUnique({
        where: { id: zone!.id },
      });
      expect(afterDelete).not.toBeNull();
      expect(afterDelete!.isActive).toBe(false);
    });
  });
});
