import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Role, SessionStatus, SpaceStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { createTestApp, loginAs } from './e2e-helpers';

/**
 * E2E Sprint 6 — concurrencia y consistencia.
 *
 * El Sprint 5 ya probó que de N peticiones simultáneas sobre un puesto solo
 * una gana. Aquí se comprueba lo que falta:
 *   1. que la garantía viva en la base de datos y no solo en el servicio;
 *   2. que una transacción fallida no deje el puesto ocupado (rollback);
 *   3. que la serialización no sea excesiva: puestos distintos no se estorban.
 */
const USERS = Array.from({ length: 12 }, (_, i) => ({
  email: `e2e-conc${i}@ujap.edu.ve`,
  password: 'E2eConc123',
}));

describe('Concurrencia (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: string[];
  let userIds: string[];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const checkIn = (token: string, parkingSpaceId: string) =>
    http()
      .post('/api/v1/parking-sessions/check-in')
      .set(auth(token))
      .send({ parkingSpaceId });

  const resetSpaces = async (codes: string[]) => {
    const spaces = await prisma.parkingSpace.findMany({
      where: { code: { in: codes } },
    });
    await prisma.parkingSession.deleteMany({
      where: { parkingSpaceId: { in: spaces.map((s) => s.id) } },
    });
    await prisma.parkingSpace.updateMany({
      where: { id: { in: spaces.map((s) => s.id) } },
      data: { status: SpaceStatus.AVAILABLE },
    });
    return spaces;
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(USERS[0].password, 10);
    userIds = [];
    for (const [i, u] of USERS.entries()) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: { passwordHash, status: UserStatus.ACTIVE },
        create: {
          firstName: 'Conc',
          lastName: String(i),
          email: u.email,
          passwordHash,
          role: Role.USER,
          status: UserStatus.ACTIVE,
        },
      });
      userIds.push(user.id);
    }
    tokens = await Promise.all(USERS.map((u) => loginAs(app, u)));
  });

  afterAll(async () => {
    await prisma.parkingSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.parkingSpace.updateMany({
      where: { code: { startsWith: 'C-0' } },
      data: { status: SpaceStatus.AVAILABLE },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.parkingSession.deleteMany({
      where: { userId: { in: userIds } },
    });
  });

  describe('la garantía está en la base de datos, no solo en el servicio', () => {
    it('RN-001: el índice único parcial impide dos sesiones activas en un puesto', async () => {
      const [space] = await resetSpaces(['C-001']);

      await prisma.parkingSession.create({
        data: { userId: userIds[0], parkingSpaceId: space.id },
      });

      // Inserción directa, saltándose por completo el servicio
      await expect(
        prisma.parkingSession.create({
          data: { userId: userIds[1], parkingSpaceId: space.id },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('RN-002: y tampoco dos sesiones activas del mismo usuario', async () => {
      const [a, b] = await resetSpaces(['C-002', 'C-003']);

      await prisma.parkingSession.create({
        data: { userId: userIds[0], parkingSpaceId: a.id },
      });

      await expect(
        prisma.parkingSession.create({
          data: { userId: userIds[0], parkingSpaceId: b.id },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('una sesión cerrada no consume el cupo: se puede volver a ocupar', async () => {
      const [space] = await resetSpaces(['C-004']);

      await prisma.parkingSession.create({
        data: {
          userId: userIds[0],
          parkingSpaceId: space.id,
          status: SessionStatus.COMPLETED,
          checkOutAt: new Date(),
        },
      });

      // El índice es PARCIAL (solo status ACTIVE), así que esto debe pasar
      const nueva = await prisma.parkingSession.create({
        data: { userId: userIds[1], parkingSpaceId: space.id },
      });
      expect(nueva.status).toBe(SessionStatus.ACTIVE);
    });
  });

  describe('rollback', () => {
    it('si la sesión no puede crearse, el puesto no queda ocupado', async () => {
      const [space] = await resetSpaces(['C-005']);

      // Estado inconsistente a propósito: hay una sesión activa sobre el
      // puesto, pero el puesto figura AVAILABLE. El UPDATE atómico tendrá
      // éxito y después el índice único rechazará la segunda sesión, lo que
      // debe deshacer TODA la transacción.
      await prisma.parkingSession.create({
        data: { userId: userIds[0], parkingSpaceId: space.id },
      });
      await prisma.parkingSpace.update({
        where: { id: space.id },
        data: { status: SpaceStatus.AVAILABLE },
      });

      const res = await checkIn(tokens[1], space.id);
      expect(res.status).toBeGreaterThanOrEqual(400);

      // Lo que importa: el puesto NO quedó OCCUPIED por una transacción rota
      const after = await prisma.parkingSpace.findUniqueOrThrow({
        where: { id: space.id },
      });
      expect(after.status).toBe(SpaceStatus.AVAILABLE);

      const sessions = await prisma.parkingSession.count({
        where: { parkingSpaceId: space.id, status: SessionStatus.ACTIVE },
      });
      expect(sessions).toBe(1);
    });
  });

  describe('la serialización no es excesiva', () => {
    it('12 usuarios sobre 12 puestos distintos: todos ganan', async () => {
      const codes = Array.from(
        { length: 12 },
        (_, i) => `C-0${String(i + 10).padStart(2, '0')}`,
      );
      const spaces = await resetSpaces(codes);
      expect(spaces).toHaveLength(12);

      const responses = await Promise.all(
        tokens.map((token, i) => checkIn(token, spaces[i].id)),
      );

      expect(responses.every((r) => r.status === 201)).toBe(true);

      const active = await prisma.parkingSession.count({
        where: {
          parkingSpaceId: { in: spaces.map((s) => s.id) },
          status: SessionStatus.ACTIVE,
        },
      });
      expect(active).toBe(12);

      const occupied = await prisma.parkingSpace.count({
        where: {
          id: { in: spaces.map((s) => s.id) },
          status: SpaceStatus.OCCUPIED,
        },
      });
      expect(occupied).toBe(12);
    });

    it('liberaciones simultáneas dejan todos los puestos disponibles', async () => {
      const codes = Array.from(
        { length: 12 },
        (_, i) => `C-0${String(i + 10).padStart(2, '0')}`,
      );
      const spaces = await resetSpaces(codes);

      const checkIns = await Promise.all(
        tokens.map((token, i) => checkIn(token, spaces[i].id)),
      );
      const sessionIds = checkIns.map(
        (r) => (r.body as { data: { id: string } }).data.id,
      );

      const releases = await Promise.all(
        sessionIds.map((id, i) =>
          http()
            .post(`/api/v1/parking-sessions/${id}/check-out`)
            .set(auth(tokens[i])),
        ),
      );

      expect(releases.every((r) => r.status === 200)).toBe(true);

      const available = await prisma.parkingSpace.count({
        where: {
          id: { in: spaces.map((s) => s.id) },
          status: SpaceStatus.AVAILABLE,
        },
      });
      expect(available).toBe(12);
    });
  });
});
