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
 * Tope de sesiones activas por categoría (RN-002 revisada).
 *
 * Un estudiante puede tener 2 puestos registrados a la vez; profesores y
 * administrativos, 1. El tope lo impone el índice único (userId, slot) de
 * PostgreSQL, no un recuento en la aplicación.
 */
const PEOPLE = {
  STUDENT: { email: 'e2e-lim-student@ujap.edu.ve', password: 'E2eLim1234' },
  PROFESSOR: { email: 'e2e-lim-prof@ujap.edu.ve', password: 'E2eLim1234' },
};

/** Zona A = estudiantes, zona E = profesores. */
const STUDENT_SPACES = ['A-080', 'A-081', 'A-082'];
const PROFESSOR_SPACES = ['E-080', 'E-081'];

describe('Tope de sesiones por categoría (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokens: Record<keyof typeof PEOPLE, string>;
  let userIds: string[];

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  const idOf = async (code: string) =>
    (await prisma.parkingSpace.findUniqueOrThrow({ where: { code } })).id;

  const checkIn = async (who: keyof typeof PEOPLE, code: string) =>
    http()
      .post('/api/v1/parking-sessions/check-in')
      .set(auth(tokens[who]))
      .send({ parkingSpaceId: await idOf(code) });

  /** El helper es asíncrono, así que la aserción va sobre la respuesta ya resuelta. */
  const expectCheckIn = async (
    who: keyof typeof PEOPLE,
    code: string,
    status: number,
  ) => {
    const res = await checkIn(who, code);
    expect(res.status).toBe(status);
    return res;
  };

  const allCodes = [...STUDENT_SPACES, ...PROFESSOR_SPACES];

  const reset = async () => {
    await prisma.parkingSession.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.parkingSpace.updateMany({
      where: { code: { in: allCodes } },
      data: { status: SpaceStatus.AVAILABLE },
    });
  };

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
          firstName: 'Lim',
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
    };
  });

  afterAll(async () => {
    await reset();
    await purgeUsers(prisma, { id: { in: userIds } });
    await app.close();
  });

  beforeEach(reset);

  describe('estudiante: hasta 2 puestos', () => {
    it('puede registrar un segundo puesto', async () => {
      await checkIn('STUDENT', STUDENT_SPACES[0]).then((r) =>
        expect(r.status).toBe(201),
      );
      await checkIn('STUDENT', STUDENT_SPACES[1]).then((r) =>
        expect(r.status).toBe(201),
      );

      const sessions = await prisma.parkingSession.findMany({
        where: { userId: userIds[0], status: SessionStatus.ACTIVE },
        orderBy: { slot: 'asc' },
      });

      expect(sessions).toHaveLength(2);
      // Cada sesión ocupa un cupo distinto: es lo que impide una tercera
      expect(sessions.map((s) => s.slot)).toEqual([1, 2]);
    });

    it('el tercero se rechaza con 409 y nombra los puestos ocupados', async () => {
      await checkIn('STUDENT', STUDENT_SPACES[0]);
      await checkIn('STUDENT', STUDENT_SPACES[1]);

      const res = await expectCheckIn('STUDENT', STUDENT_SPACES[2], 409);
      const body = res.body as {
        code: string;
        message: string;
        activeSpaces: string[];
        limit: number;
      };

      expect(body.code).toBe('USER_ALREADY_HAS_ACTIVE_SESSION');
      expect(body.limit).toBe(2);
      expect(body.activeSpaces).toEqual([STUDENT_SPACES[0], STUDENT_SPACES[1]]);
      expect(body.message).toContain('máximo');

      const tercero = await prisma.parkingSpace.findUniqueOrThrow({
        where: { code: STUDENT_SPACES[2] },
      });
      expect(tercero.status).toBe(SpaceStatus.AVAILABLE);
    });

    it('al liberar uno queda su cupo libre para otro puesto', async () => {
      const first = await expectCheckIn('STUDENT', STUDENT_SPACES[0], 201);
      await expectCheckIn('STUDENT', STUDENT_SPACES[1], 201);

      await http()
        .post(
          `/api/v1/parking-sessions/${(first.body as { data: { id: string } }).data.id}/check-out`,
        )
        .set(auth(tokens.STUDENT))
        .expect(200);

      await expectCheckIn('STUDENT', STUDENT_SPACES[2], 201);

      const sessions = await prisma.parkingSession.findMany({
        where: { userId: userIds[0], status: SessionStatus.ACTIVE },
        orderBy: { slot: 'asc' },
      });
      expect(sessions).toHaveLength(2);
      // Reutiliza el cupo 1, que quedó libre
      expect(sessions.map((s) => s.slot).sort()).toEqual([1, 2]);
    });

    it('/me/active devuelve ambos puestos y el tope', async () => {
      await checkIn('STUDENT', STUDENT_SPACES[0]);
      await checkIn('STUDENT', STUDENT_SPACES[1]);

      const res = await http()
        .get('/api/v1/parking-sessions/me/active')
        .set(auth(tokens.STUDENT))
        .expect(200);

      const { data } = res.body as {
        data: { limit: number; sessions: { parkingSpace: { code: string } }[] };
      };
      expect(data.limit).toBe(2);
      expect(data.sessions.map((s) => s.parkingSpace.code)).toEqual(
        STUDENT_SPACES.slice(0, 2),
      );
    });
  });

  describe('profesor: sigue con un solo puesto', () => {
    it('el segundo se rechaza', async () => {
      await expectCheckIn('PROFESSOR', PROFESSOR_SPACES[0], 201);

      const res = await expectCheckIn('PROFESSOR', PROFESSOR_SPACES[1], 409);
      const body = res.body as { limit: number; message: string };

      expect(body.limit).toBe(1);
      expect(body.message).toContain('Libérelo antes');
    });
  });

  describe('el tope lo impone la base de datos', () => {
    it('una tercera sesión activa es imposible aunque se inserte directamente', async () => {
      const [a, b] = await Promise.all([
        idOf(STUDENT_SPACES[0]),
        idOf(STUDENT_SPACES[1]),
      ]);

      await prisma.parkingSession.create({
        data: { userId: userIds[0], parkingSpaceId: a, slot: 1 },
      });
      await prisma.parkingSession.create({
        data: { userId: userIds[0], parkingSpaceId: b, slot: 2 },
      });

      // Solo existen los cupos 1 y 2: repetir cualquiera choca con el índice
      await expect(
        prisma.parkingSession.create({
          data: {
            userId: userIds[0],
            parkingSpaceId: await idOf(STUDENT_SPACES[2]),
            slot: 1,
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('dos peticiones simultáneas del mismo usuario no crean 3 sesiones', async () => {
      await expectCheckIn('STUDENT', STUDENT_SPACES[0], 201);

      // Doble pulsación sobre dos puestos distintos a la vez
      const [x, y] = await Promise.all([
        checkIn('STUDENT', STUDENT_SPACES[1]),
        checkIn('STUDENT', STUDENT_SPACES[2]),
      ]);

      const creadas = [x, y].filter((r) => r.status === 201).length;
      expect(creadas).toBeLessThanOrEqual(1);

      const activas = await prisma.parkingSession.count({
        where: { userId: userIds[0], status: SessionStatus.ACTIVE },
      });
      expect(activas).toBeLessThanOrEqual(2);
    });
  });
});
