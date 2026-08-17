import { Injectable, Logger } from '@nestjs/common';
import {
  MaintenanceStatus,
  ReservationStatus,
  SessionStatus,
  SpaceStatus,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * Única autoridad sobre el estado de un puesto cuando cambia algo a su
 * alrededor: una reserva, un bloqueo de mantenimiento o una sesión.
 *
 * Vive aquí y no en reservas ni en mantenimiento porque ambos módulos
 * necesitan lo mismo, y el estado del puesto pertenece al módulo de puestos.
 */
@Injectable()
export class SpaceStatusService {
  private readonly logger = new Logger(SpaceStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula el estado a partir de la realidad, con esta precedencia:
   *
   *   ocupado > mantenimiento > reserva vigente > disponible
   *
   * El mantenimiento gana sobre la reserva porque un puesto físicamente
   * inutilizable no sirve aunque alguien lo tenga reservado (sección 9).
   *
   * Nunca toca un puesto OCCUPIED ni DISABLED: el primero tiene a alguien
   * dentro y el segundo lo apagó un administrador a propósito.
   */
  async sync(parkingSpaceId: string): Promise<SpaceStatus> {
    const now = new Date();

    const space = await this.prisma.parkingSpace.findUnique({
      where: { id: parkingSpaceId },
      select: { code: true, status: true },
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
      this.prisma.reservation.findFirst({
        where: {
          parkingSpaceId,
          status: {
            in: [ReservationStatus.CONFIRMED, ReservationStatus.ACTIVE],
          },
          startAt: { lte: now },
          endAt: { gt: now },
        },
        select: { id: true },
      }),
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
      this.logger.log(`Puesto ${space.code}: ${space.status} → ${next}`);
    }

    return next;
  }

  /** Sincroniza varios puestos, evitando repetidos. */
  async syncMany(parkingSpaceIds: Iterable<string>): Promise<number> {
    const unique = new Set(parkingSpaceIds);
    for (const id of unique) await this.sync(id);
    return unique.size;
  }
}
