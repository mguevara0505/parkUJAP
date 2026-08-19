import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MaintenanceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { SpaceStatusService } from '../parking-spaces/space-status.service';

/**
 * Jobs de mantenimiento (sección 45), cada minuto.
 *
 * El estado se deriva de las fechas, así que una caída del servidor se recupera
 * sola en la siguiente ejecución: no hay que reponer ejecuciones perdidas.
 */
@Injectable()
export class MaintenanceScheduler {
  private readonly logger = new Logger(MaintenanceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceStatus: SpaceStatusService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    const touched = new Set<string>();

    // 1. Activar los bloqueos cuyo período ya empezó
    const toActivate = await this.prisma.maintenanceBlock.findMany({
      where: {
        status: MaintenanceStatus.SCHEDULED,
        startAt: { lte: now },
        endAt: { gt: now },
      },
      select: { id: true, parkingSpaceId: true },
    });

    if (toActivate.length > 0) {
      await this.prisma.maintenanceBlock.updateMany({
        where: { id: { in: toActivate.map((b) => b.id) } },
        data: { status: MaintenanceStatus.ACTIVE },
      });
      toActivate.forEach((b) => touched.add(b.parkingSpaceId));
    }

    // 2. Cerrar los vencidos. RN-009: como todo bloqueo tiene fin, ningún
    //    puesto se queda fuera de servicio porque alguien olvidó reactivarlo.
    const expired = await this.prisma.maintenanceBlock.findMany({
      where: {
        status: {
          in: [MaintenanceStatus.SCHEDULED, MaintenanceStatus.ACTIVE],
        },
        endAt: { lte: now },
      },
      select: { id: true, parkingSpaceId: true },
    });

    if (expired.length > 0) {
      await this.prisma.maintenanceBlock.updateMany({
        where: { id: { in: expired.map((b) => b.id) } },
        data: { status: MaintenanceStatus.COMPLETED },
      });
      expired.forEach((b) => touched.add(b.parkingSpaceId));
    }

    // 3. Devolver cada puesto afectado al estado que le corresponde
    const synced = await this.spaceStatus.syncMany(touched);

    if (touched.size > 0) {
      this.logger.log(
        `Mantenimiento: ${toActivate.length} activados, ${expired.length} finalizados, ${synced} puestos sincronizados`,
      );
    }

    return {
      activated: toActivate.length,
      closed: expired.length,
      spacesSynced: synced,
    };
  }
}
