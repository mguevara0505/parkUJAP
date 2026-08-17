import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateMaintenanceBlockDto } from './create-maintenance-block.dto';

/**
 * `parkingSpaceId` es inmutable: mover un bloqueo a otro puesto es cancelarlo
 * y crear otro, y así queda el rastro de qué puesto estuvo fuera de servicio.
 */
export class UpdateMaintenanceBlockDto extends PartialType(
  OmitType(CreateMaintenanceBlockDto, ['parkingSpaceId'] as const),
) {}
