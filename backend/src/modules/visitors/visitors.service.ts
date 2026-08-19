import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { VisitorQueryDto } from './dto/visitor-query.dto';

/** Visitantes externos a la universidad (sección 12). */
@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateVisitorDto) {
    const visitor = await this.prisma.visitor.create({ data: dto });
    this.logger.log(
      `Visitante creado: ${visitor.firstName} ${visitor.lastName}`,
    );
    return visitor;
  }

  async findAll(query: VisitorQueryDto) {
    const { page = 1, limit = 20, search, organization } = query;

    const where: Prisma.VisitorWhereInput = {
      ...(organization && {
        organization: { contains: organization, mode: 'insensitive' },
      }),
      // El administrador busca por lo que tiene a mano: un nombre, la cédula
      // que le dictan por teléfono o la placa que ve llegar
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { documentId: { contains: search, mode: 'insensitive' } },
          { vehiclePlate: { contains: search, mode: 'insensitive' } },
          { organization: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.visitor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        include: { _count: { select: { reservations: true } } },
      }),
      this.prisma.visitor.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /** Incluye el historial de reservas del visitante (pantalla A05). */
  async findOne(id: string) {
    const visitor = await this.prisma.visitor.findUnique({
      where: { id },
      include: {
        reservations: {
          orderBy: { startAt: 'desc' },
          take: 50,
          select: {
            id: true,
            title: true,
            status: true,
            reservationType: true,
            startAt: true,
            endAt: true,
            vehiclePlate: true,
            parkingSpace: {
              select: {
                id: true,
                code: true,
                zone: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!visitor) {
      throw new NotFoundException(`Visitante con ID ${id} no encontrado`);
    }

    return visitor;
  }

  async update(id: string, dto: UpdateVisitorDto) {
    await this.findOne(id);

    const visitor = await this.prisma.visitor.update({
      where: { id },
      data: dto,
    });

    this.logger.log(
      `Visitante actualizado: ${visitor.firstName} ${visitor.lastName}`,
    );
    return visitor;
  }

  /**
   * Solo se puede eliminar un visitante sin reservas.
   *
   * Un visitante con historial es parte de la trazabilidad de quién estuvo en
   * el campus (sección 2): borrarlo dejaría reservas huérfanas. No se usa
   * soft-delete porque el modelo de la sección 12 no tiene campo de estado y
   * añadirlo sin que el documento lo pida sería inventar requisitos.
   */
  async remove(id: string) {
    const visitor = await this.findOne(id);

    const reservations = await this.prisma.reservation.count({
      where: { visitorId: id },
    });

    if (reservations > 0) {
      const activas = await this.prisma.reservation.count({
        where: {
          visitorId: id,
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE],
          },
        },
      });

      throw new ConflictException({
        code: 'VISITOR_HAS_RESERVATIONS',
        message: `No se puede eliminar a ${visitor.firstName} ${visitor.lastName}: tiene ${reservations} reserva(s) en su historial${
          activas > 0 ? `, ${activas} de ellas vigente(s)` : ''
        }. El historial debe conservarse.`,
      });
    }

    await this.prisma.visitor.delete({ where: { id } });

    this.logger.log(
      `Visitante eliminado: ${visitor.firstName} ${visitor.lastName}`,
    );
    return { message: 'Visitante eliminado correctamente' };
  }
}
