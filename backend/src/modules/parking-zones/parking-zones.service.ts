import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateParkingZoneDto } from './dto/create-parking-zone.dto';
import { UpdateParkingZoneDto } from './dto/update-parking-zone.dto';
import { ParkingZoneQueryDto } from './dto/parking-zone-query.dto';

/** Zonas dentro de un estacionamiento (sección 8.3). */
@Injectable()
export class ParkingZonesService {
  private readonly logger = new Logger(ParkingZonesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateParkingZoneDto) {
    // Mensaje explícito: la FK daría un 400 genérico que no dice qué falta
    const lot = await this.prisma.parkingLot.findUnique({
      where: { id: dto.parkingLotId },
      select: { id: true },
    });

    if (!lot) {
      throw new NotFoundException(
        `Estacionamiento con ID ${dto.parkingLotId} no encontrado`,
      );
    }

    const zone = await this.prisma.parkingZone.create({ data: dto });
    this.logger.log(`Zona creada: ${zone.code} — ${zone.name}`);
    return zone;
  }

  async findAll(query: ParkingZoneQueryDto) {
    const { page = 1, limit = 20, search, parkingLotId, isActive } = query;

    const where: Prisma.ParkingZoneWhereInput = {
      ...(parkingLotId && { parkingLotId }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.parkingZone.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        include: {
          parkingLot: { select: { id: true, name: true, code: true } },
          _count: { select: { spaces: true } },
        },
      }),
      this.prisma.parkingZone.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const zone = await this.prisma.parkingZone.findUnique({
      where: { id },
      include: {
        parkingLot: { select: { id: true, name: true, code: true } },
        _count: { select: { spaces: true } },
      },
    });

    if (!zone) {
      throw new NotFoundException(`Zona con ID ${id} no encontrada`);
    }

    return zone;
  }

  async update(id: string, dto: UpdateParkingZoneDto) {
    await this.findOne(id);

    const zone = await this.prisma.parkingZone.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Zona actualizada: ${zone.code}`);
    return zone;
  }

  /** Desactiva la zona (soft-delete): sus puestos e historial se conservan. */
  async remove(id: string) {
    await this.findOne(id);

    const zone = await this.prisma.parkingZone.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Zona desactivada: ${zone.code}`);
    return { message: 'Zona desactivada correctamente', zone };
  }
}
