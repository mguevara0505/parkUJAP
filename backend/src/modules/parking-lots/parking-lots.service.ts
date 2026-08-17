import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { UpdateParkingLotDto } from './dto/update-parking-lot.dto';
import { ParkingLotQueryDto } from './dto/parking-lot-query.dto';

/**
 * Gestión de estacionamientos físicos (sección 8.2).
 *
 * ponytail: un estacionamiento inactivo NO desactiva sus zonas en cascada. Las
 * consultas de disponibilidad deben filtrar por `zone.parkingLot.isActive` para
 * no mostrar puestos de un estacionamiento cerrado — un cascade en escritura se
 * desincronizaría al reactivar. A respetar en el Sprint 3 (puestos y mapa).
 */
@Injectable()
export class ParkingLotsService {
  private readonly logger = new Logger(ParkingLotsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateParkingLotDto) {
    const lot = await this.prisma.parkingLot.create({ data: dto });
    this.logger.log(`Estacionamiento creado: ${lot.code} — ${lot.name}`);
    return lot;
  }

  async findAll(query: ParkingLotQueryDto) {
    const { page = 1, limit = 20, search, isActive } = query;

    const where: Prisma.ParkingLotWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.parkingLot.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { zones: true } } },
      }),
      this.prisma.parkingLot.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const lot = await this.prisma.parkingLot.findUnique({
      where: { id },
      include: {
        zones: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { spaces: true } } },
        },
      },
    });

    if (!lot) {
      throw new NotFoundException(`Estacionamiento con ID ${id} no encontrado`);
    }

    return lot;
  }

  async update(id: string, dto: UpdateParkingLotDto) {
    await this.findOne(id);

    const lot = await this.prisma.parkingLot.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Estacionamiento actualizado: ${lot.code}`);
    return lot;
  }

  /**
   * Desactiva el estacionamiento (soft-delete). Nunca se borra físicamente:
   * sus zonas, puestos e historial de sesiones deben conservarse.
   */
  async remove(id: string) {
    await this.findOne(id);

    const lot = await this.prisma.parkingLot.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Estacionamiento desactivado: ${lot.code}`);
    return { message: 'Estacionamiento desactivado correctamente', lot };
  }
}
