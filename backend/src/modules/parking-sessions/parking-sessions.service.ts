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
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CheckInDto } from './dto/check-in.dto';
import { SessionQueryDto } from './dto/session-query.dto';

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
    const session = await this.prisma.$transaction(async (tx) => {
      // RN-002 — una sola sesión activa por usuario
      const active = await tx.parkingSession.findFirst({
        where: { userId, status: SessionStatus.ACTIVE },
        include: SESSION_INCLUDE,
      });

      if (active) {
        throw new ConflictException({
          code: 'USER_ALREADY_HAS_ACTIVE_SESSION',
          message: `Ya tiene una sesión activa en el puesto ${active.parkingSpace.code}. Libérelo antes de registrar otro.`,
        });
      }

      // RN-001, RN-003, RN-004 y RN-014: una sola escritura atómica.
      // Solo un puesto AVAILABLE, de una zona y un estacionamiento activos,
      // puede pasar a OCCUPIED.
      const { count } = await tx.parkingSpace.updateMany({
        where: {
          id: dto.parkingSpaceId,
          status: SpaceStatus.AVAILABLE,
          zone: { isActive: true, parkingLot: { isActive: true } },
        },
        data: { status: SpaceStatus.OCCUPIED },
      });

      // RN-005 — el puesto reservado lo bloquea "otro usuario", no su titular.
      // Sin esto, un profesor con puesto reservado no podría registrarlo.
      let reservationId: string | undefined;

      if (count === 0) {
        reservationId = await this.claimOwnReservation(
          tx,
          dto.parkingSpaceId,
          userId,
        );

        if (!reservationId) {
          await this.explainWhyUnavailable(tx, dto.parkingSpaceId);
        }
      }

      return tx.parkingSession.create({
        data: {
          userId,
          parkingSpaceId: dto.parkingSpaceId,
          reservationId,
          source: dto.source,
          notes: dto.notes,
        },
        include: SESSION_INCLUDE,
      });
    });

    this.logger.log(
      `Check-in: usuario ${userId} → puesto ${session.parkingSpace.code}`,
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

  /**
   * Distingue "el puesto no existe" de "está ocupado" o "su zona está
   * cerrada". Solo se ejecuta cuando el UPDATE atómico ya falló, así que no
   * introduce ninguna carrera: sirve únicamente para el mensaje de error.
   */
  private async explainWhyUnavailable(
    tx: Prisma.TransactionClient,
    parkingSpaceId: string,
  ): Promise<never> {
    const space = await tx.parkingSpace.findUnique({
      where: { id: parkingSpaceId },
      select: {
        code: true,
        status: true,
        zone: {
          select: {
            isActive: true,
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

  /** Sesión activa del usuario, o null (pantalla 05). */
  findMyActive(userId: string) {
    return this.prisma.parkingSession.findFirst({
      where: { userId, status: SessionStatus.ACTIVE },
      include: SESSION_INCLUDE,
    });
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
