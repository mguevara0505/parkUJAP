import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MaintenanceStatus,
  Prisma,
  ReservationStatus,
  SessionStatus,
  SpaceStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationQueryDto } from './dto/reservation-query.dto';

/**
 * Zona horaria de la universidad. Los mensajes de error los lee una persona
 * que escribió "08:00" en el formulario: mostrarle "12:00Z" es incomprensible.
 * ponytail: constante y no configuración porque el sistema es de un único
 * campus. Si algún día hay sedes en otro huso, pasa a la tabla ParkingLot.
 */
const CAMPUS_TIMEZONE = 'America/Caracas';

function formatCampusTime(date: Date): string {
  return date.toLocaleString('es-VE', {
    timeZone: CAMPUS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Estados en los que una reserva sigue protegiendo el puesto. */
export const LIVE_RESERVATION_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.ACTIVE,
] as const;

const RESERVATION_INCLUDE = {
  parkingSpace: {
    select: {
      id: true,
      code: true,
      type: true,
      priority: true,
      zone: { select: { id: true, code: true, name: true } },
    },
  },
  visitor: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organization: true,
      vehiclePlate: true,
    },
  },
  user: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdByAdmin: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReservationInclude;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una reserva anticipada (CU-007).
   *
   * RN-006 la garantiza la restricción EXCLUDE de PostgreSQL, no un SELECT
   * previo: comprobar y después insertar sería la carrera de la sección 25.
   * Aquí solo se traduce la violación a un mensaje que el administrador pueda
   * entender, indicando con qué reserva chocó.
   */
  async create(adminId: string, dto: CreateReservationDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new ConflictException({
        code: 'INVALID_RESERVATION_RANGE',
        message: 'La hora de fin debe ser posterior a la de inicio',
      });
    }

    await this.assertSpaceExists(dto.parkingSpaceId);
    await this.assertVisitorExists(dto.visitorId);

    try {
      const reservation = await this.prisma.reservation.create({
        data: {
          ...dto,
          startAt,
          endAt,
          createdByAdminId: adminId,
          status: ReservationStatus.CONFIRMED,
        },
        include: RESERVATION_INCLUDE,
      });

      this.logger.log(
        `Reserva creada: ${reservation.parkingSpace.code} ${startAt.toISOString()} → ${endAt.toISOString()}`,
      );

      // Si el período ya empezó, el puesto debe protegerse de inmediato
      await this.syncSpaceStatus(reservation.parkingSpaceId);

      return this.findOne(reservation.id);
    } catch (error) {
      await this.explainOverlap(error, dto.parkingSpaceId, startAt, endAt);
      throw error;
    }
  }

  /**
   * Traduce la violación de la restricción EXCLUDE a un 409 con el detalle de
   * la reserva que ya ocupaba ese intervalo.
   */
  private async explainOverlap(
    error: unknown,
    parkingSpaceId: string,
    startAt: Date,
    endAt: Date,
  ): Promise<void> {
    const isOverlap =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      JSON.stringify(error.meta ?? {}).includes('reservations_no_overlap');

    if (!isOverlap) return;

    const conflict = await this.prisma.reservation.findFirst({
      where: {
        parkingSpaceId,
        status: { in: [...LIVE_RESERVATION_STATUSES] },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true, title: true, startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });

    throw new ConflictException({
      code: 'RESERVATION_OVERLAP',
      message: conflict
        ? `El puesto ya está reservado del ${formatCampusTime(conflict.startAt)} al ${formatCampusTime(conflict.endAt)} ("${conflict.title}")`
        : 'El puesto ya tiene una reserva que se solapa con ese horario',
      conflictingReservationId: conflict?.id,
    });
  }

  private async assertSpaceExists(parkingSpaceId: string) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: parkingSpaceId },
      select: { id: true },
    });

    if (!space) {
      throw new NotFoundException(
        `Puesto con ID ${parkingSpaceId} no encontrado`,
      );
    }
  }

  /**
   * Sin esto, un visitante inexistente produce un error de clave ajena que el
   * filtro global traduce a un 400 genérico; el administrador merece saber que
   * el problema es el visitante y no el puesto ni las fechas.
   */
  private async assertVisitorExists(visitorId?: string) {
    if (!visitorId) return;

    const visitor = await this.prisma.visitor.findUnique({
      where: { id: visitorId },
      select: { id: true },
    });

    if (!visitor) {
      throw new NotFoundException(
        `Visitante con ID ${visitorId} no encontrado`,
      );
    }
  }

  async findAll(query: ReservationQueryDto) {
    const { page = 1, limit = 20, search } = query;

    const where: Prisma.ReservationWhereInput = {
      ...(query.parkingSpaceId && { parkingSpaceId: query.parkingSpaceId }),
      ...(query.visitorId && { visitorId: query.visitorId }),
      ...(query.status && { status: query.status }),
      ...(query.reservationType && {
        reservationType: query.reservationType,
      }),
      // Solapamiento con la ventana consultada, no contención
      ...(query.from && { endAt: { gt: new Date(query.from) } }),
      ...(query.to && { startAt: { lt: new Date(query.to) } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { vehiclePlate: { contains: search, mode: 'insensitive' } },
          { parkingSpace: { code: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: RESERVATION_INCLUDE,
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: RESERVATION_INCLUDE,
    });

    if (!reservation) {
      throw new NotFoundException(`Reserva con ID ${id} no encontrada`);
    }

    return reservation;
  }

  async update(id: string, dto: UpdateReservationDto) {
    const existing = await this.findOne(id);

    if (
      existing.status === ReservationStatus.COMPLETED ||
      existing.status === ReservationStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: 'RESERVATION_CLOSED',
        message: 'No se puede modificar una reserva ya cerrada',
      });
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : existing.endAt;

    if (endAt <= startAt) {
      throw new ConflictException({
        code: 'INVALID_RESERVATION_RANGE',
        message: 'La hora de fin debe ser posterior a la de inicio',
      });
    }

    try {
      await this.prisma.reservation.update({
        where: { id },
        data: { ...dto, startAt, endAt },
      });
    } catch (error) {
      await this.explainOverlap(error, existing.parkingSpaceId, startAt, endAt);
      throw error;
    }

    await this.syncSpaceStatus(existing.parkingSpaceId);
    return this.findOne(id);
  }

  /** RN-007 — el administrador puede cancelar una reserva. */
  async cancel(id: string) {
    const existing = await this.findOne(id);

    if (existing.status === ReservationStatus.CANCELLED) {
      throw new ConflictException({
        code: 'RESERVATION_ALREADY_CANCELLED',
        message: 'La reserva ya estaba cancelada',
      });
    }

    if (existing.status === ReservationStatus.COMPLETED) {
      throw new ConflictException({
        code: 'RESERVATION_CLOSED',
        message: 'No se puede cancelar una reserva ya completada',
      });
    }

    await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
    });

    // Al dejar de proteger el puesto, este vuelve a estar disponible
    await this.syncSpaceStatus(existing.parkingSpaceId);

    this.logger.log(`Reserva cancelada: ${existing.parkingSpace.code}`);
    return this.findOne(id);
  }

  /** Activación manual; el job programado hace lo mismo automáticamente. */
  async activate(id: string) {
    const existing = await this.findOne(id);

    if (existing.status === ReservationStatus.ACTIVE) return existing;

    if (
      existing.status !== ReservationStatus.CONFIRMED &&
      existing.status !== ReservationStatus.PENDING
    ) {
      throw new ConflictException({
        code: 'RESERVATION_NOT_ACTIVATABLE',
        message: `No se puede activar una reserva en estado ${existing.status}`,
      });
    }

    await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.ACTIVE },
    });

    await this.syncSpaceStatus(existing.parkingSpaceId);
    return this.findOne(id);
  }

  async complete(id: string) {
    const existing = await this.findOne(id);

    if (
      existing.status === ReservationStatus.COMPLETED ||
      existing.status === ReservationStatus.CANCELLED
    ) {
      throw new ConflictException({
        code: 'RESERVATION_CLOSED',
        message: 'La reserva ya está cerrada',
      });
    }

    await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.COMPLETED },
    });

    await this.syncSpaceStatus(existing.parkingSpaceId);
    return this.findOne(id);
  }

  /**
   * Reservas que protegen un puesto en un instante dado. La usa el check-in
   * para aplicar RN-005 y el job programado.
   */
  liveReservationAt(parkingSpaceId: string, at: Date) {
    return this.prisma.reservation.findFirst({
      where: {
        parkingSpaceId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE] },
        startAt: { lte: at },
        endAt: { gt: at },
      },
    });
  }

  /**
   * Recalcula el estado del puesto a partir de la realidad: ocupación >
   * mantenimiento > reserva vigente > disponible.
   *
   * Nunca toca un puesto OCCUPIED ni DISABLED: el primero tiene a alguien
   * dentro y el segundo lo apagó un administrador a propósito.
   */
  async syncSpaceStatus(parkingSpaceId: string): Promise<SpaceStatus> {
    const now = new Date();

    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: parkingSpaceId },
      select: { status: true },
    });

    if (
      !space ||
      space.status === SpaceStatus.OCCUPIED ||
      space.status === SpaceStatus.DISABLED
    ) {
      return space?.status ?? SpaceStatus.AVAILABLE;
    }

    const [session, maintenance, reservation] = await Promise.all([
      this.prisma.parkingSession.findFirst({
        where: { parkingSpaceId, status: SessionStatus.ACTIVE },
        select: { id: true },
      }),
      this.prisma.maintenanceBlock.findFirst({
        where: {
          parkingSpaceId,
          status: {
            in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.ACTIVE],
          },
          startAt: { lte: now },
          endAt: { gt: now },
        },
        select: { id: true },
      }),
      this.liveReservationAt(parkingSpaceId, now),
    ]);

    const next = session
      ? SpaceStatus.OCCUPIED
      : maintenance
        ? SpaceStatus.MAINTENANCE
        : reservation
          ? SpaceStatus.RESERVED
          : SpaceStatus.AVAILABLE;

    if (next !== space.status) {
      await this.prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: next },
      });
    }

    return next;
  }
}
