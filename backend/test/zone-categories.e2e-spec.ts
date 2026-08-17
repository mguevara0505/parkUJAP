import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import {
  Role,
  SessionStatus,
  SpaceStatus,
  UserCategory,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { createTestApp, loginAs, purgeUsers } from './e2e-helpers';

/**
 * Reparto de zonas por categoría de usuario.
 *
 * A-D estudiantes · E-G profesores · H administrativos ·
 * I y J solo por reserva (autoridades, proveedores y eventos).
 *
 * Requiere el seed aplicado: usa las zonas y sus `allowedCategories`.
 */
const PEOPLE = {
  STUDENT: { email: 'e2e-cat-student@ujap.edu.ve', password: 'E2eCat1234' },
  PROFESSOR: { email: 'e2e-cat-prof@ujap.edu.ve', password: 'E2eCat1234' },
  STAFF: { email: 'e2e-cat-staff@ujap.edu.ve', password: 'E2eCat1234' },
};

/** Un puesto de cada zona, elegido lejos de los que usan otras suites. */
const SPACE_OF_ZONE: Record<string, string> = {
  A: 'A-070',
  E: 'E-070',
  H: 'H-070',
  I: 'I-070',
  J: 'J-070',
};

describe('Zonas por categoría (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Record<keyof typeof PEOPLE, string>;
  let userIds: string[];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const spaceIdOf = async (zone: string) =>
    (
      await prisma.parkingSpace.findUniqueOrThrow({
        where: { code: SPACE_OF_ZONE[zone] },
      })
    ).id;

  const checkIn = async (who: keyof typeof PEOPLE, zone: string) =>
    http()
      .post('/api/v1/parking-sessions/check-in')
      .set(auth(tokens[who]))
      .send({ parkingSpaceId: await spaceIdOf(zone) });

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash(PEOPLE.STUDENT.password, 10);
    userIds = [];

    for (const [category, creds] of Object.entries(PEOPLE)) {
      const user = await prisma.user.upsert({
        where: { email: creds.email },
        update: {
          passwordHash,
          category: category as UserCategory,
          status: UserStatus.ACTIVE,
        },
        create: {
          firstName: 'Cat',
          lastName: category,
          email: creds.email,
          passwordHash,
          role: Role.USER,
          category: category as UserCategory,
          status: UserStatus.ACTIVE,
        },
      });
      userIds.push(user.id);
    }

    tokens = {
      STUDENT: await loginAs(app, PEOPLE.STUDENT),
      PROFESSOR: await loginAs(app, PEOPLE.PROFESSOR),
      STAFF: await loginAs(app, PEOPLE.STAFF),
    };
  });

  afterAll(async () => {
    await prisma.parkingSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.reservation.deleteMany({
      where: { parkingSpace: { code: { in: Object.values(SPACE_OF_ZONE) } } },
    });
    await purgeUsers(prisma, { id: { in: userIds } });
    await prisma.parkingSpace.updateMany({
      where: { code: { in: Object.values(SPACE_OF_ZONE) } },
      data: { status: SpaceStatus.AVAILABLE },
    });
    await app.close();
  });

  beforeEach(async () => {
    await prisma.parkingSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.reservation.deleteMany({
      where: { parkingSpace: { code: { in: Object.values(SPACE_OF_ZONE) } } },
    });
    await prisma.parkingSpace.updateMany({
      where: { code: { in: Object.values(SPACE_OF_ZONE) } },
      data: { status: SpaceStatus.AVAILABLE },
    });
  });

  describe('cada quien en su zona', () => {
    it.each([
      ['STUDENT', 'A'],
      ['PROFESSOR', 'E'],
      ['STAFF', 'H'],
    ] as const)('%s puede estacionarse en la zona %s', async (who, zone) => {
      await checkIn(who, zone).then((r) => expect(r.status).toBe(201));

      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { code: SPACE_OF_ZONE[zone] },
      });
      expect(space.status).toBe(SpaceStatus.OCCUPIED);
    });
  });

  describe('bloqueo entre categorías', () => {
    it.each([
      ['STUDENT', 'E'],
      ['STUDENT', 'H'],
      ['PROFESSOR', 'A'],
      ['PROFESSOR', 'H'],
      ['STAFF', 'A'],
      ['STAFF', 'E'],
    ] as const)('%s NO puede estacionarse en la zona %s', async (who, zone) => {
      const res = await checkIn(who, zone);

      expect(res.status).toBe(409);
      expect((res.body as { code: string }).code).toBe(
        'ZONE_NOT_ALLOWED_FOR_CATEGORY',
      );

      // El puesto no se tocó: el UPDATE atómico nunca llegó a aplicarse
      const space = await prisma.parkingSpace.findUniqueOrThrow({
        where: { code: SPACE_OF_ZONE[zone] },
      });
      expect(space.status).toBe(SpaceStatus.AVAILABLE);

      const sessions = await prisma.parkingSession.count({
        where: { parkingSpaceId: space.id, status: SessionStatus.ACTIVE },
      });
      expect(sessions).toBe(0);
    });

    it('el error dice qué zonas le corresponden', async () => {
      const res = await checkIn('STUDENT', 'E');

      const body = res.body as { message: string; allowedZones: string[] };
      expect(body.allowedZones).toEqual(
        expect.arrayContaining(['A', 'B', 'C', 'D']),
      );
      expect(body.allowedZones).not.toContain('E');
      expect(body.message).toContain('A, B, C y D');
    });
  });

  describe('zonas I y J: solo por reserva', () => {
    it.each([
      ['STUDENT', 'I'],
      ['PROFESSOR', 'I'],
      ['STAFF', 'J'],
      ['PROFESSOR', 'J'],
    ] as const)(
      '%s no puede registrarse por su cuenta en %s',
      async (who, zone) => {
        const res = await checkIn(who, zone);

        expect(res.status).toBe(409);
        expect((res.body as { code: string }).code).toBe(
          'ZONE_NOT_ALLOWED_FOR_CATEGORY',
        );
        expect((res.body as { message: string }).message).toContain(
          'reserva exclusiva',
        );
      },
    );

    it('con una reserva a su nombre sí puede ocupar la zona J', async () => {
      const parkingSpaceId = await spaceIdOf('J');
      const admin = await prisma.user.findFirstOrThrow({
        where: { role: Role.ADMIN },
      });
      const professor = await prisma.user.findUniqueOrThrow({
        where: { email: PEOPLE.PROFESSOR.email },
      });

      // Reserva vigente ahora mismo a nombre del profesor invitado
      await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          userId: professor.id,
          title: 'Profesor invitado — acto de grado',
          startAt: new Date(Date.now() - 3_600_000),
          endAt: new Date(Date.now() + 3_600_000),
          status: 'CONFIRMED',
        },
      });
      await prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.RESERVED },
      });

      // La reserva es la vía de acceso a las zonas exclusivas
      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(tokens.PROFESSOR))
        .send({ parkingSpaceId })
        .expect(201);

      expect(
        (res.body as { data: { parkingSpace: { code: string } } }).data
          .parkingSpace.code,
      ).toBe(SPACE_OF_ZONE.J);
    });

    it('pero otro usuario sigue sin poder entrar a esa reserva', async () => {
      const parkingSpaceId = await spaceIdOf('J');
      const admin = await prisma.user.findFirstOrThrow({
        where: { role: Role.ADMIN },
      });
      const professor = await prisma.user.findUniqueOrThrow({
        where: { email: PEOPLE.PROFESSOR.email },
      });

      await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          userId: professor.id,
          title: 'Reserva ajena',
          startAt: new Date(Date.now() - 3_600_000),
          endAt: new Date(Date.now() + 3_600_000),
          status: 'CONFIRMED',
        },
      });
      await prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.RESERVED },
      });

      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(tokens.STAFF))
        .send({ parkingSpaceId })
        .expect(409);

      // En una zona exclusiva la razón que se devuelve es la de zona, no la de
      // reserva: aunque el puesto quedara libre, esta persona seguiría sin
      // poder usarlo. Decirle "está reservado" la haría volver a intentarlo.
      expect((res.body as { code: string }).code).toBe(
        'ZONE_NOT_ALLOWED_FOR_CATEGORY',
      );

      const sessions = await prisma.parkingSession.count({
        where: { parkingSpaceId, status: SessionStatus.ACTIVE },
      });
      expect(sessions).toBe(0);
    });

    it('en una zona normal sí se distingue "reservado para otro"', async () => {
      const parkingSpaceId = await spaceIdOf('A');
      const admin = await prisma.user.findFirstOrThrow({
        where: { role: Role.ADMIN },
      });
      const professor = await prisma.user.findUniqueOrThrow({
        where: { email: PEOPLE.PROFESSOR.email },
      });

      await prisma.reservation.create({
        data: {
          parkingSpaceId,
          createdByAdminId: admin.id,
          userId: professor.id,
          title: 'Reserva en zona de estudiantes',
          startAt: new Date(Date.now() - 3_600_000),
          endAt: new Date(Date.now() + 3_600_000),
          status: 'CONFIRMED',
        },
      });
      await prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.RESERVED },
      });

      // El estudiante sí puede usar la zona A: el impedimento es la reserva
      const res = await http()
        .post('/api/v1/parking-sessions/check-in')
        .set(auth(tokens.STUDENT))
        .send({ parkingSpaceId })
        .expect(409);

      expect((res.body as { code: string }).code).toBe(
        'PARKING_SPACE_RESERVED',
      );
    });
  });

  describe('el mapa informa el reparto', () => {
    it('cada zona expone las categorías que admite', async () => {
      const res = await http()
        .get('/api/v1/parking-spaces/map')
        .set(auth(tokens.STUDENT))
        .expect(200);

      const zones = (
        res.body as {
          data: { zones: { code: string; allowedCategories: string[] }[] };
        }
      ).data.zones;

      const byCode = Object.fromEntries(
        zones.map((z) => [z.code, z.allowedCategories]),
      );

      expect(byCode.A).toEqual(['STUDENT']);
      expect(byCode.E).toEqual(['PROFESSOR']);
      expect(byCode.H).toEqual(['STAFF']);
      expect(byCode.I).toEqual([]);
      expect(byCode.J).toEqual([]);
    });
  });
});
