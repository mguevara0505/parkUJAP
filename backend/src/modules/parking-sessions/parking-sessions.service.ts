import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenanceStatus,
  Prisma,
  ReservationStatus,
  Role,
  SessionStatus,
  SpaceStatus,
  UserCategory,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CheckInDto } from './dto/check-in.dto';
import { SessionQueryDto } from './dto/session-query.dto';

/**
 * Cuántos puestos puede tener ocupados a la vez cada categoría (RN-002).
 *
 * Un estudiante puede necesitar dos —coche y moto, o un vehículo compartido
 * con un compañero—, mientras que a profesores y administrativos les
 * corresponde uno. El tope real lo impone el índice único de la base de datos
 * sobre (userId, slot): aquí solo se decide qué cupo pedir.
 *
 * ponytail: constante y no configuración en base de datos. Cuando la
 * universidad quiera cambiarlo por reglamento, se mueve a ParkingLot o a una
 * tabla de parámetros; hoy sería configuración sin nadie que la configure.
 */
export const ACTIVE_SESSION_LIMIT: Record<UserCategory, number> = {
  STUDENT: 2,
  PROFESSOR: 1,
  STAFF: 1,
};

/** Datos del puesto que acompañan a una sesión en las respuestas. */
const SESSION_INCLUDE = {
  parkingSpace: {
    select: {
      id: true,
      code: true,
      type: true,
      isCovered: true,
      isAccessible: true,
      zone: {
        select: {
          id: true,
          code: true,
          name: true,
          parkingLot: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.ParkingSessionInclude;

@Injectable()
export class ParkingSessionsService {
  private readonly logger = new Logger(ParkingSessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra que el usuario se estacionó en un puesto (CU-003).
   *
   * Sección 25 — control de concurrencia. La comprobación y la escritura son
   * una sola sentencia atómica: `updateMany` con `status: AVAILABLE` en el
   * WHERE. Si dos peticiones llegan a la vez, PostgreSQL serializa el UPDATE y
   * solo una encuentra el puesto disponible; la otra recibe count 0 y un 409.
   * Consultar antes con un findUnique y decidir en Node sería justo la carrera
   * que el documento pide evitar.
   *
   * RN-002 la garantiza además un índice único parcial en la base de datos.
   */
  async checkIn(userId: string, dto: CheckInDto) {
    try {
      return await this.runCheckIn(userId, dto);
    } catch (error) {
      // Doble pulsación simultánea: ambas eligieron el mismo cupo y el índice
      // único rechazó una. Sin esto el usuario vería un mensaje sobre columnas.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        JSON.stringify(error.meta ?? {}).includes('slot')
      ) {
        throw new ConflictException({
          code: 'USER_ALREADY_HAS_ACTIVE_SESSION',
          message:
            'Ya se registró otro puesto en este mismo instante. Revise sus estacionamientos activos.',
        });
      }
      throw error;
    }
  }

  private async runCheckIn(userId: string, dto: CheckInDto) {
    const session = await this.prisma.$transaction(async (tx) => {
      const { category } = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { category: true },
      });

      // RN-002 — tope de sesiones activas según la categoría
      const limit = ACTIVE_SESSION_LIMIT[category];

      const active = await tx.parkingSession.findMany({
        where: { userId, status: SessionStatus.ACTIVE },
        include: SESSION_INCLUDE,
        orderBy: { slot: 'asc' },
      });

      if (active.length >= limit) {
        const ocupados = active.map((s) => s.parkingSpace.code).join(' y ');
        throw new ConflictException({
          code: 'USER_ALREADY_HAS_ACTIVE_SESSION',
          message:
            limit === 1
              ? `Ya tiene una sesión activa en el puesto ${ocupados}. Libérelo antes de registrar otro.`
              : `Ya tiene ${limit} puestos registrados (${ocupados}), que es su máximo. Libere uno antes de registrar otro.`,
          activeSpaces: active.map((s) => s.parkingSpace.code),
          limit,
        });
      }

      // Primer cupo libre. Si dos peticiones simultáneas eligen el mismo, el
      // índice único rechaza una y su transacción se deshace entera.
      const used = new Set(active.map((s) => s.slot));
      const slot = Array.from({ length: limit }, (_, i) => i + 1).find(
        (n) => !used.has(n),
      )!;

      // RN-001, RN-003, RN-004 y RN-014: una sola escritura atómica.
      // Solo un puesto AVAILABLE, de una zona y un estacionamiento activos y
      // abierta a la categoría del usuario, puede pasar a OCCUPIED. La
      // restricción de zona viaja en el mismo WHERE para no abrir una carrera
      // nueva entre comprobarla y escribir.
      const { count } = await tx.parkingSpace.updateMany({
        where: {
          id: dto.parkingSpaceId,
          status: SpaceStatus.AVAILABLE,
          zone: {
            isActive: true,
            parkingLot: { isActive: true },
            allowedCategories: { has: category },
          },
        },
        data: { status: SpaceStatus.OCCUPIED },
      });

      // RN-005 — el puesto reservado lo bloquea "otro usuario", no su titular.
      // Sin esto, un profesor con puesto reservado no podría registrarlo.
      // La reserva también salta la restricción de zona: es justo el mecanismo
      // por el que se accede a las zonas exclusivas de autoridades y eventos.
      let reservationId: string | undefined;

      if (count === 0) {
        reservationId = await this.claimOwnReservation(
          tx,
          dto.parkingSpaceId,
          userId,
        );

        if (!reservationId) {
          await this.explainWhyUnavailable(tx, dto.parkingSpaceId, category);
        }
      }

      return tx.parkingSession.create({
        data: {
          userId,
          parkingSpaceId: dto.parkingSpaceId,
          reservationId,
          slot,
          source: dto.source,
          notes: dto.notes,
        },
        include: SESSION_INCLUDE,
      });
    });

    this.logger.log(
      `Check-in: usuario ${userId} → puesto ${session.parkingSpace.code} (cupo ${session.slot})`,
    );
    return session;
  }

  /**
   * RN-005 — permite ocupar un puesto RESERVED si la reserva vigente es del
   * propio usuario. Devuelve el id de la reserva, o undefined si no le
   * corresponde.
   *
   * Sigue siendo atómico: el UPDATE exige status RESERVED, así que si el job
   * o un administrador cambian el estado a la vez, esta petición pierde.
   */
  private async claimOwnReservation(
    tx: Prisma.TransactionClient,
    parkingSpaceId: string,
    userId: string,
  ): Promise<string | undefined> {
    const now = new Date();

    const reservation = await tx.reservation.findFirst({
      where: {
        parkingSpaceId,
        userId,
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE],
        },
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true },
    });

    if (!reservation) return undefined;

    const { count } = await tx.parkingSpace.updateMany({
      where: {
        id: parkingSpaceId,
        status: SpaceStatus.RESERVED,
        zone: { isActive: true, parkingLot: { isActive: true } },
      },
      data: { status: SpaceStatus.OCCUPIED },
    });

    return count === 1 ? reservation.id : undefined;
  }

  /** "Sus zonas son A, B, C y D." — vacío si no tiene ninguna asignada. */
  private suggestZones(zones: { code: string }[]): string {
    if (zones.length === 0) return '';

    const codes = zones.map((z) => z.code);
    const list =
      codes.length === 1
        ? codes[0]
        : `${codes.slice(0, -1).join(', ')} y ${codes[codes.length - 1]}`;

    return ` Sus zonas ${codes.length === 1 ? 'es' : 'son'}: ${list}.`;
  }

  /**
   * Distingue "el puesto no existe" de "está ocupado", "su zona está cerrada"
   * o "esa zona no es para su categoría". Solo se ejecuta cuando el UPDATE
   * atómico ya falló, así que no introduce ninguna carrera: sirve únicamente
   * para el mensaje de error.
   */
  private async explainWhyUnavailable(
    tx: Prisma.TransactionClient,
    parkingSpaceId: string,
    category: UserCategory,
  ): Promise<never> {
    const space = await tx.parkingSpace.findUnique({
      where: { id: parkingSpaceId },
      select: {
        code: true,
        status: true,
        zone: {
          select: {
            code: true,
            name: true,
            isActive: true,
            allowedCategories: true,
            parkingLot: { select: { isActive: true } },
          },
        },
      },
    });

    if (!space) {
      throw new NotFoundException(
        `Puesto con ID ${parkingSpaceId} no encontrado`,
      );
    }

    if (!space.zone.isActive || !space.zone.parkingLot.isActive) {
      throw new ConflictException({
        code: 'PARKING_SPACE_NOT_AVAILABLE',
        message: `El puesto ${space.code} pertenece a una zona o estacionamiento fuera de servicio`,
      });
    }

    // La zona no admite a esta categoría. Se comprueba antes que el estado
    // porque decirle "está ocupado" a quien nunca podría usarlo lo mandaría a
    // buscar otro puesto de la misma zona una y otra vez.
    if (!space.zone.allowedCategories.includes(category)) {
      const mine = await tx.parkingZone.findMany({
        where: {
          isActive: true,
          allowedCategories: { has: category },
          parkingLot: { isActive: true },
        },
        select: { code: true },
        orderBy: { sortOrder: 'asc' },
      });

      throw new ConflictException({
        code: 'ZONE_NOT_ALLOWED_FOR_CATEGORY',
        message:
          space.zone.allowedCategories.length === 0
            ? `La ${space.zone.name} es de reserva exclusiva: los puestos se asignan desde una reserva administrativa.${this.suggestZones(mine)}`
            : `La ${space.zone.name} no corresponde a su categoría.${this.suggestZones(mine)}`,
        allowedZones: mine.map((z) => z.code),
      });
    }

    if (space.status === SpaceStatus.RESERVED) {
      throw new ConflictException({
        code: 'PARKING_SPACE_RESERVED',
        message: `El puesto ${space.code} está reservado para otra persona en este momento`,
      });
    }

    // Formato de error de la sección 31
    throw new ConflictException({
      code: 'PARKING_SPACE_NOT_AVAILABLE',
      message: `El puesto ${space.code} ya no se encuentra disponible`,
    });
  }

  /**
   * Libera el puesto (CU-004). El dueño de la sesión o un ADMIN
   * ("liberar administrativamente", pantalla A03).
   */
  async checkOut(sessionId: string, requesterId: string, requesterRole: Role) {
    const session = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.parkingSession.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, status: true, parkingSpaceId: true },
      });

      if (!existing) {
        throw new NotFoundException(`Sesión con ID ${sessionId} no encontrada`);
      }

      if (existing.userId !== requesterId && requesterRole !== Role.ADMIN) {
        throw new ForbiddenException('Solo puede liberar su propio puesto');
      }

      if (existing.status !== SessionStatus.ACTIVE) {
        throw new ConflictException({
          code: 'SESSION_NOT_ACTIVE',
          message: 'Esta sesión ya fue cerrada',
        });
      }

      const nextStatus = await this.nextSpaceStatus(
        tx,
        existing.parkingSpaceId,
      );

      await tx.parkingSpace.update({
        where: { id: existing.parkingSpaceId },
        data: { status: nextStatus },
      });

      return tx.parkingSession.update({
        where: { id: sessionId },
        data: { status: SessionStatus.COMPLETED, checkOutAt: new Date() },
        include: SESSION_INCLUDE,
      });
    });

    this.logger.log(
      `Check-out: puesto ${session.parkingSpace.code} liberado por ${requesterId}`,
    );
    return session;
  }

  /**
   * RN-015 — al liberar, el puesto vuelve a AVAILABLE salvo que exista una
   * reserva o un mantenimiento vigente en ese mismo momento.
   *
   * El mantenimiento gana sobre la reserva: si el puesto está físicamente
   * inutilizable, da igual que alguien lo tenga reservado.
   */
  private async nextSpaceStatus(
    tx: Prisma.TransactionClient,
    parkingSpaceId: string,
  ): Promise<SpaceStatus> {
    const now = new Date();

    // Secuencial, no Promise.all: una transacción es una única conexión y
    // lanzar dos consultas a la vez sobre ella es un error del driver.
    const maintenance = await tx.maintenanceBlock.findFirst({
      where: {
        parkingSpaceId,
        status: {
          in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.ACTIVE],
        },
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true },
    });

    if (maintenance) return SpaceStatus.MAINTENANCE;

    const reservation = await tx.reservation.findFirst({
      where: {
        parkingSpaceId,
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE],
        },
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true },
    });

    return reservation ? SpaceStatus.RESERVED : SpaceStatus.AVAILABLE;
  }

  /**
   * Puestos que el usuario tiene registrados ahora (pantalla 05), junto con su
   * tope. La interfaz necesita el tope para saber si ofrecer registrar otro.
   */
  async findMyActive(userId: string) {
    const { category } = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { category: true },
    });

    const sessions = await this.prisma.parkingSession.findMany({
      where: { userId, status: SessionStatus.ACTIVE },
      include: SESSION_INCLUDE,
      orderBy: { slot: 'asc' },
    });

    return { limit: ACTIVE_SESSION_LIMIT[category], sessions };
  }

  /** Historial personal (pantalla 06, CU-005). */
  async findMyHistory(userId: string, query: SessionQueryDto) {
    const { page = 1, limit = 20 } = query;

    const where: Prisma.ParkingSessionWhereInput = {
      userId,
      ...(query.status && { status: query.status }),
      ...this.dateRange(query),
    };

    const [data, total] = await Promise.all([
      this.prisma.parkingSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { checkInAt: 'desc' },
        include: SESSION_INCLUDE,
      }),
      this.prisma.parkingSession.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /** Historial completo — solo ADMIN (sección 7.2). */
  async findAll(query: SessionQueryDto) {
    const { page = 1, limit = 20 } = query;

    const where: Prisma.ParkingSessionWhereInput = {
      ...(query.userId && { userId: query.userId }),
      ...(query.parkingSpaceId && { parkingSpaceId: query.parkingSpaceId }),
      ...(query.status && { status: query.status }),
      ...this.dateRange(query),
    };

    const [data, total] = await Promise.all([
      this.prisma.parkingSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { checkInAt: 'desc' },
        include: {
          ...SESSION_INCLUDE,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              universityId: true,
            },
          },
        },
      }),
      this.prisma.parkingSession.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  private dateRange(query: SessionQueryDto): Prisma.ParkingSessionWhereInput {
    if (!query.from && !query.to) return {};

    return {
      checkInAt: {
        ...(query.from && { gte: new Date(query.from) }),
        ...(query.to && { lte: new Date(query.to) }),
      },
    };
  }
}
