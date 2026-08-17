import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MaintenanceReason } from '@prisma/client';

export class CreateMaintenanceBlockDto {
  @ApiProperty({ description: 'Puesto que queda fuera de servicio' })
  @IsUUID()
  parkingSpaceId: string;

  @ApiProperty({
    enum: MaintenanceReason,
    example: MaintenanceReason.PAINTING,
    description: 'Motivo del bloqueo (sección 13)',
  })
  @IsEnum(MaintenanceReason)
  reason: MaintenanceReason;

  @ApiProperty({
    example: '2026-08-20T07:00:00Z',
    description:
      'Inicio del bloqueo. RN-009: todo bloqueo tiene inicio y fin, para que el puesto no quede olvidado fuera de servicio.',
  })
  @IsDateString()
  startAt: string;

  @ApiProperty({
    example: '2026-08-20T15:00:00Z',
    description: 'Fin del bloqueo (RN-009)',
  })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ example: 'Repintado de líneas y numeración' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

// `status` no se acepta: lo derivan las fechas y el job programado.
