import { Injectable } from '@nestjs/common';
import { ReservationStatus, SessionStatus, SpaceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

/** KPIs de la sección 22. */
export interface DashboardSummary {
  totalSpaces: number;
  availableSpaces: number;
  occupiedSpaces: number;
  reservedSpaces: number;
  disabledSpaces: number;
  maintenanceSpaces: number;
  occupancyRate: number;
  availableRate: number;
  reservationsToday: number;
  activeSessions: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumen general (pantalla A01).
   *
   * El desglose por estado sale de un solo `groupBy` en lugar de seis
   * `count`: con ~1.000 puestos la diferencia es una consulta contra seis, y
   * el objetivo de la sección 46 es dashboard < 1 s.
   */
  async summary(): Promise<DashboardSummary> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [byStatus, activeSessions, reservationsToday] = await Promise.all([
      this.prisma.parkingSpace.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.parkingSession.count({
        where: { status: SessionStatus.ACTIVE },
      }),
      // Reservas que cubren algún momento de hoy, no solo las creadas hoy:
      // es lo que el administrador necesita saber al empezar la jornada
      this.prisma.reservation.count({
        where: {
          status: {
            in: [
              ReservationStatus.CONFIRMED,
              ReservationStatus.ACTIVE,
              ReservationStatus.PENDING,
            ],
          },
          startAt: { lt: endOfDay },
          endAt: { gt: startOfDay },
        },
      }),
    ]);

    const count = (status: SpaceStatus) =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    const totalSpaces = byStatus.reduce((sum, r) => sum + r._count._all, 0);
    const occupiedSpaces = count(SpaceStatus.OCCUPIED);
    const availableSpaces = count(SpaceStatus.AVAILABLE);

    return {
      totalSpaces,
      availableSpaces,
      occupiedSpaces,
      reservedSpaces: count(SpaceStatus.RESERVED),
      disabledSpaces: count(SpaceStatus.DISABLED),
      maintenanceSpaces: count(SpaceStatus.MAINTENANCE),
      occupancyRate: this.rate(occupiedSpaces, totalSpaces),
      availableRate: this.rate(availableSpaces, totalSpaces),
      reservationsToday,
      activeSessions,
    };
  }

  /**
   * Ocupación por zona. Sirve al administrador para ver de un vistazo qué
   * zona está saturada y cuál vacía.
   */
  async byZone() {
    const [zones, byZoneStatus] = await Promise.all([
      this.prisma.parkingZone.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          allowedCategories: true,
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.parkingSpace.groupBy({
        by: ['zoneId', 'status'],
        _count: { _all: true },
      }),
    ]);

    return zones.map((zone) => {
      const rows = byZoneStatus.filter((r) => r.zoneId === zone.id);
      const of = (status: SpaceStatus) =>
        rows.find((r) => r.status === status)?._count._all ?? 0;

      const total = rows.reduce((sum, r) => sum + r._count._all, 0);
      const occupied = of(SpaceStatus.OCCUPIED);

      return {
        ...zone,
        totalSpaces: total,
        availableSpaces: of(SpaceStatus.AVAILABLE),
        occupiedSpaces: occupied,
        reservedSpaces: of(SpaceStatus.RESERVED),
        disabledSpaces: of(SpaceStatus.DISABLED),
        maintenanceSpaces: of(SpaceStatus.MAINTENANCE),
        occupancyRate: this.rate(occupied, total),
      };
    });
  }

  /**
   * Ocupación por hora de las últimas 24 horas, contando las entradas
   * registradas en cada franja (sección 22, gráficos posteriores).
   */
  async occupancyByHour() {
    const since = new Date(Date.now() - 24 * 3_600_000);

    const sessions = await this.prisma.parkingSession.findMany({
      where: { checkInAt: { gte: since } },
      select: { checkInAt: true },
    });

    // 24 franjas fijas: así el gráfico no "salta" las horas sin actividad
    const buckets = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(since.getTime() + i * 3_600_000);
      hour.setMinutes(0, 0, 0);
      return { hour: hour.toISOString(), checkIns: 0 };
    });

    for (const session of sessions) {
      const index = Math.floor(
        (session.checkInAt.getTime() - since.getTime()) / 3_600_000,
      );
      if (index >= 0 && index < buckets.length) buckets[index].checkIns++;
    }

    return { since: since.toISOString(), buckets };
  }

  /** Porcentaje entero; 0 si no hay puestos, para no dividir entre cero. */
  private rate(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 100);
  }
}
