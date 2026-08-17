import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateParkingZoneDto } from './create-parking-zone.dto';

/**
 * `code` y `parkingLotId` se omiten: el código prefija los códigos de puesto
 * ya rotulados en el piso, y mover una zona de estacionamiento dejaría sus
 * puestos en un lugar físico distinto al registrado.
 */
export class UpdateParkingZoneDto extends PartialType(
  OmitType(CreateParkingZoneDto, ['code', 'parkingLotId'] as const),
) {}
