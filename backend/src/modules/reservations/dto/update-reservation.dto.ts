import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateReservationDto } from './create-reservation.dto';

/**
 * `parkingSpaceId` es inmutable: mover una reserva a otro puesto es cancelarla
 * y crear otra, y así queda registrado en el historial. Las fechas sí pueden
 * ajustarse; la restricción EXCLUDE vuelve a validar el solapamiento.
 */
export class UpdateReservationDto extends PartialType(
  OmitType(CreateReservationDto, ['parkingSpaceId'] as const),
) {}
