import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationStatus, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SpaceStatusService } from '../parking-spaces/space-status.service';

/**
 * Jobs programados de la sección 45, cada minuto.
 *
 * El estado se deriva siempre de las fechas, así que si el servidor estuvo
 * caído una hora la siguiente ejecución pone todo al día: no hay que
 * "recuperar" las ejecuciones perdidas.
 */
@Injectable()
export class ReservationsScheduler {
  private readonly logger = new Logger(ReservationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceStatus: SpaceStatusService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    const touched = new Set<string>();

    // 1. Activar las reservas cuyo período ya empezó
    const toActivate = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
        },
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true, parkingSpaceId: true },
    });

    if (toActivate.length > 0) {
      await this.prisma.reservation.updateMany({
        where: { id: { in: toActivate.map((r) => r.id) } },
        data: { status: ReservationStatus.ACTIVE },
      });
      toActivate.forEach((r) => touched.add(r.parkingSpaceId));
    }

    // 2. Cerrar las reservas vencidas.
    //    RN-008: si nadie llegó a ocupar el puesto, es un NO_SHOW; si hubo
    //    alguna sesión durante el período, la reserva se cumplió.
    const expired = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [
            ReservationStatus.PENDING,
            ReservationStatus.CONFIRMED,
            ReservationStatus.ACTIVE,
          ],
        },
        endAt: { lte: now },
      },
      select: { id: true, parkingSpaceId: true, startAt: true, endAt: true },
    });

    for (const reservation of expired) {
      const used = await this.prisma.parkingSession.findFirst({
        where: {
          parkingSpaceId: reservation.parkingSpaceId,
          checkInAt: { gte: reservation.startAt, lt: reservation.endAt },
          status: { in: [SessionStatus.ACTIVE, SessionStatus.COMPLETED] },
        },
        select: { id: true },
      });

      await this.prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status: used
            ? ReservationStatus.COMPLETED
            : ReservationStatus.NO_SHOW,
        },
      });

      touched.add(reservation.parkingSpaceId);
    }

    // 3. Devolver cada puesto afectado al estado que le corresponde
    await this.spaceStatus.syncMany(touched);

    if (touched.size > 0) {
      this.logger.log(
        `Reservas: ${toActivate.length} activadas, ${expired.length} cerradas, ${touched.size} puestos sincronizados`,
      );
    }

    return {
      activated: toActivate.length,
      closed: expired.length,
      spacesSynced: touched.size,
    };
  }
}
