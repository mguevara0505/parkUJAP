import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SpaceStatus } from '@prisma/client';
import { CreateParkingSpaceDto } from './create-parking-space.dto';

/**
 * Estados que un ADMIN puede fijar a mano (sección 7.2 — "activar/desactivar
 * puestos", "bloquear puestos por mantenimiento").
 *
 * OCCUPIED y RESERVED quedan fuera a propósito: el primero solo puede nacer de
 * un check-in (Sprint 5) y el segundo de una reserva (Sprint 7). Permitir
 * fijarlos por PATCH dejaría el puesto ocupado sin ParkingSession asociada,
 * rompiendo RN-001 y el historial.
 */
export const ADMIN_SETTABLE_STATUSES = [
  SpaceStatus.AVAILABLE,
  SpaceStatus.DISABLED,
  SpaceStatus.MAINTENANCE,
] as const;

export type AdminSettableStatus = (typeof ADMIN_SETTABLE_STATUSES)[number];

/** `code` y `zoneId` son inmutables: identifican el puesto rotulado en el piso. */
export class UpdateParkingSpaceDto extends PartialType(
  OmitType(CreateParkingSpaceDto, ['code', 'zoneId'] as const),
) {
  @ApiPropertyOptional({
    enum: ADMIN_SETTABLE_STATUSES,
    description:
      'Solo AVAILABLE, DISABLED o MAINTENANCE. OCCUPIED y RESERVED los gestionan las sesiones y las reservas.',
  })
  @IsOptional()
  @IsEnum(ADMIN_SETTABLE_STATUSES, {
    message:
      'Estado inválido. Un administrador solo puede fijar AVAILABLE, DISABLED o MAINTENANCE',
  })
  status?: AdminSettableStatus;
}
