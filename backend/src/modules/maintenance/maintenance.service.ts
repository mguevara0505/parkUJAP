import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MaintenanceStatus, Prisma, SpaceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { SpaceStatusService } from '../parking-spaces/space-status.service';
import { CreateMaintenanceBlockDto } from './dto/create-maintenance-block.dto';
import { UpdateMaintenanceBlockDto } from './dto/update-maintenance-block.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';

/** Estados en los que el bloqueo todavía afecta al puesto. */
export const LIVE_MAINTENANCE_STATUSES = [
  MaintenanceStatus.SCHEDULED,
  MaintenanceStatus.ACTIVE,
] as const;

const BLOCK_INCLUDE = {
  parkingSpace: {
    select: {
      id: true,
      code: true,
      status: true,
      zone: { select: { id: true, code: true, name: true } },
    },
  },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.MaintenanceBlockInclude;

/** Bloqueos temporales de puestos (sección 13). */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceStatus: SpaceStatusService,
  ) {}

  /**
   * Crea un bloqueo (CU-009).
   *
   * RN-009 — inicio y fin obligatorios: sin fecha de fin, un puesto pintado un
   * martes se quedaría fuera de servicio para siempre porque nadie recordaría
   * reactivarlo.
   *
   * RN-010 — si el bloqueo empieza ya, el puesto pasa a MAINTENANCE en el acto.
   * Eso lo resuelve `SpaceStatusService`, que además respeta la precedencia:
   * un puesto ocupado ahora mismo no se le arrebata a quien está dentro; el
   * job lo recogerá cuando libere.
   */
  async create(adminId: string, dto: CreateMaintenanceBlockDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (endAt <= startAt) {
      throw new ConflictException({
        code: 'INVALID_MAINTENANCE_RANGE',
        message: 'La fecha de fin debe ser posterior a la de inicio',
      });
    }

    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: dto.parkingSpaceId },
      select: { id: true, code: true },
    });

    if (!space) {
      throw new NotFoundException(
        `Puesto con ID ${dto.parkingSpaceId} no encontrado`,
      );
    }

    const block = await this.prisma.maintenanceBlock.create({
      data: {
        ...dto,
        startAt,
        endAt,
        createdById: adminId,
        // Si ya empezó nace activo; si es a futuro, queda programado
        status:
          startAt <= new Date()
            ? MaintenanceStatus.ACTIVE
            : MaintenanceStatus.SCHEDULED,
      },
    });

    const nuevoEstado = await this.spaceStatus.sync(dto.parkingSpaceId);

    this.logger.log(
      `Bloqueo ${dto.reason} en ${space.code}: ${block.status}, puesto → ${nuevoEstado}`,
    );

    return this.findOne(block.id);
  }

  async findAll(query: MaintenanceQueryDto) {
    const { page = 1, limit = 20, search } = query;

    const where: Prisma.MaintenanceBlockWhereInput = {
      ...(query.parkingSpaceId && { parkingSpaceId: query.parkingSpaceId }),
      ...(query.status && { status: query.status }),
      ...(query.reason && { reason: query.reason }),
      // Solapamiento con la ventana consultada, no contención
      ...(query.from && { endAt: { gt: new Date(query.from) } }),
      ...(query.to && { startAt: { lt: new Date(query.to) } }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { parkingSpace: { code: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.maintenanceBlock.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { startAt: 'desc' },
        include: BLOCK_INCLUDE,
      }),
      this.prisma.maintenanceBlock.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const block = await this.prisma.maintenanceBlock.findUnique({
      where: { id },
      include: BLOCK_INCLUDE,
    });

    if (!block) {
      throw new NotFoundException(`Bloqueo con ID ${id} no encontrado`);
    }

    return block;
  }

  async update(id: string, dto: UpdateMaintenanceBlockDto) {
    const existing = await this.findOne(id);

    if (!this.isLive(existing.status)) {
      throw new ConflictException({
        code: 'MAINTENANCE_CLOSED',
        message: 'No se puede modificar un bloqueo ya cerrado',
      });
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : existing.endAt;

    if (endAt <= startAt) {
      throw new ConflictException({
        code: 'INVALID_MAINTENANCE_RANGE',
        message: 'La fecha de fin debe ser posterior a la de inicio',
      });
    }

    await this.prisma.maintenanceBlock.update({
      where: { id },
      data: { ...dto, startAt, endAt },
    });

    await this.spaceStatus.sync(existing.parkingSpaceId);
    return this.findOne(id);
  }

  /** El trabajo se canceló: el puesto vuelve a servicio si nada más lo impide. */
  async cancel(id: string) {
    return this.close(id, MaintenanceStatus.CANCELLED, 'cancelado');
  }

  /** El trabajo terminó antes de lo previsto (CU-010). */
  async complete(id: string) {
    return this.close(id, MaintenanceStatus.COMPLETED, 'completado');
  }

  private async close(id: string, status: MaintenanceStatus, verbo: string) {
    const existing = await this.findOne(id);

    if (!this.isLive(existing.status)) {
      throw new ConflictException({
        code: 'MAINTENANCE_CLOSED',
        message: `El bloqueo ya está ${existing.status === MaintenanceStatus.CANCELLED ? 'cancelado' : 'completado'}`,
      });
    }

    await this.prisma.maintenanceBlock.update({
      where: { id },
      data: { status },
    });

    // Al dejar de bloquear, el puesto vuelve al estado que le corresponda
    const nuevoEstado = await this.spaceStatus.sync(existing.parkingSpaceId);

    this.logger.log(
      `Bloqueo ${verbo} en ${existing.parkingSpace.code}: puesto → ${nuevoEstado}`,
    );

    return this.findOne(id);
  }

  private isLive(status: MaintenanceStatus): boolean {
    return (LIVE_MAINTENANCE_STATUSES as readonly MaintenanceStatus[]).includes(
      status,
    );
  }

  /**
   * Puestos actualmente fuera de servicio, para el mapa y el dashboard.
   * Se apoya en el estado del puesto, no en las fechas, porque es el estado el
   * que decide si alguien puede ocuparlo.
   */
  countBlockedSpaces() {
    return this.prisma.parkingSpace.count({
      where: { status: SpaceStatus.MAINTENANCE },
    });
  }
}
