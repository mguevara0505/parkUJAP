import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, SpaceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateParkingSpaceDto } from './dto/create-parking-space.dto';
import { UpdateParkingSpaceDto } from './dto/update-parking-space.dto';
import {
  ParkingSpaceFiltersDto,
  ParkingSpaceQueryDto,
} from './dto/parking-space-query.dto';

/**
 * Campos mínimos que necesita el mapa para dibujar un puesto (sección 19).
 * Deliberadamente sin relaciones: son ~1.000 registros y el objetivo de la
 * sección 46 es GET map < 500 ms.
 */
const MAP_SELECT = {
  id: true,
  code: true,
  status: true,
  type: true,
  zoneId: true,
  priority: true,
  isAccessible: true,
  isCovered: true,
  positionX: true,
  positionY: true,
  width: true,
  height: true,
  rotation: true,
} satisfies Prisma.ParkingSpaceSelect;

@Injectable()
export class ParkingSpacesService {
  private readonly logger = new Logger(ParkingSpacesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Traduce los filtros de la API a un WHERE de Prisma.
   *
   * `onlyUsable` restringe a estructura activa: un puesto de una zona o de un
   * estacionamiento desactivado no debe ofrecerse como disponible. Es el filtro
   * de lectura que sustituye al cascade en escritura (ver ParkingLotsService).
   */
  private buildWhere(
    filters: ParkingSpaceFiltersDto,
    { onlyUsable = false }: { onlyUsable?: boolean } = {},
  ): Prisma.ParkingSpaceWhereInput {
    const {
      parkingLotId,
      zoneId,
      status,
      type,
      isAccessible,
      isCovered,
      maxPriority,
    } = filters;

    const zone: Prisma.ParkingZoneWhereInput = {
      ...(parkingLotId && { parkingLotId }),
      ...(onlyUsable && { isActive: true, parkingLot: { isActive: true } }),
    };

    return {
      ...(zoneId && { zoneId }),
      ...(status && { status }),
      ...(type && { type }),
      ...(isAccessible !== undefined && { isAccessible }),
      ...(isCovered !== undefined && { isCovered }),
      ...(maxPriority !== undefined && { priority: { lte: maxPriority } }),
      ...(Object.keys(zone).length > 0 && { zone }),
    };
  }

  async create(dto: CreateParkingSpaceDto) {
    const zone = await this.prisma.parkingZone.findUnique({
      where: { id: dto.zoneId },
      select: { id: true },
    });

    if (!zone) {
      throw new NotFoundException(`Zona con ID ${dto.zoneId} no encontrada`);
    }

    const space = await this.prisma.parkingSpace.create({ data: dto });
    this.logger.log(`Puesto creado: ${space.code}`);
    return space;
  }

  /** Listado administrativo paginado con filtros y búsqueda por código. */
  async findAll(query: ParkingSpaceQueryDto) {
    const { page = 1, limit = 20, search } = query;

    const where: Prisma.ParkingSpaceWhereInput = {
      ...this.buildWhere(query),
      ...(search && { code: { contains: search, mode: 'insensitive' } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.parkingSpace.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          zone: {
            select: {
              id: true,
              code: true,
              name: true,
              parkingLot: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.parkingSpace.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /**
   * Puestos realmente ocupables ahora mismo.
   * RN-003 y RN-004: DISABLED y MAINTENANCE quedan fuera por definición, al
   * filtrar únicamente por AVAILABLE.
   */
  async findAvailable(filters: ParkingSpaceFiltersDto) {
    const spaces = await this.prisma.parkingSpace.findMany({
      where: {
        ...this.buildWhere(filters, { onlyUsable: true }),
        status: SpaceStatus.AVAILABLE,
      },
      select: MAP_SELECT,
      // Mejor prioridad primero: sirve para sugerir los mejores puestos (§17)
      orderBy: [{ priority: 'asc' }, { code: 'asc' }],
    });

    return { total: spaces.length, spaces };
  }

  /**
   * Datos del mapa (sección 19). Devuelve todos los puestos que cumplen el
   * filtro, sin paginar, junto con las zonas y los límites del plano para que
   * el frontend pueda calcular el viewBox del SVG sin recorrer dos veces.
   */
  async findForMap(filters: ParkingSpaceFiltersDto) {
    const where = this.buildWhere(filters);

    const [spaces, zones] = await Promise.all([
      this.prisma.parkingSpace.findMany({
        where,
        select: MAP_SELECT,
        orderBy: { code: 'asc' },
      }),
      this.prisma.parkingZone.findMany({
        where: {
          ...(filters.parkingLotId && { parkingLotId: filters.parkingLotId }),
          ...(filters.zoneId && { id: filters.zoneId }),
        },
        select: {
          id: true,
          code: true,
          name: true,
          sortOrder: true,
          isActive: true,
          // El mapa resalta las zonas que corresponden a quien mira
          allowedCategories: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    return {
      total: spaces.length,
      bounds: {
        width: Math.max(0, ...spaces.map((s) => s.positionX + s.width)),
        height: Math.max(0, ...spaces.map((s) => s.positionY + s.height)),
      },
      zones,
      spaces,
    };
  }

  async findOne(id: string) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { id },
      include: {
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
            floor: true,
            parkingLot: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!space) {
      throw new NotFoundException(`Puesto con ID ${id} no encontrado`);
    }

    return space;
  }

  /** Busca por código (A-001), como lo teclea un administrador. */
  async findByCode(code: string) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        zone: {
          select: {
            id: true,
            code: true,
            name: true,
            parkingLot: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!space) {
      throw new NotFoundException(`Puesto con código ${code} no encontrado`);
    }

    return space;
  }

  async update(id: string, dto: UpdateParkingSpaceDto) {
    await this.findOne(id);

    const space = await this.prisma.parkingSpace.update({
      where: { id },
      data: dto,
    });

    if (dto.status) {
      this.logger.log(`Puesto ${space.code} → ${space.status}`);
    }

    return space;
  }

  /**
   * DELETE deshabilita el puesto (sección 9: AVAILABLE → DISABLED). No se
   * borra nunca: su historial de sesiones y reservas debe conservarse.
   */
  async remove(id: string) {
    await this.findOne(id);

    const space = await this.prisma.parkingSpace.update({
      where: { id },
      data: { status: SpaceStatus.DISABLED },
    });

    this.logger.log(`Puesto deshabilitado: ${space.code}`);
    return { message: 'Puesto deshabilitado correctamente', space };
  }
}
