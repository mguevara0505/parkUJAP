import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateParkingLotDto } from './create-parking-lot.dto';

/**
 * El `code` se omite a propósito: es el identificador estable que usan los
 * códigos de zona y de puesto (A-001, B-002...). Renombrarlo invalidaría
 * referencias impresas en el estacionamiento físico.
 */
export class UpdateParkingLotDto extends PartialType(
  OmitType(CreateParkingLotDto, ['code'] as const),
) {}
