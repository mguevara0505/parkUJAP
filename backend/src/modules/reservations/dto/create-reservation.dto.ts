import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReservationType } from '@prisma/client';

export class CreateReservationDto {
  @ApiProperty({ description: 'Puesto que se reserva' })
  @IsUUID()
  parkingSpaceId: string;

  @ApiProperty({
    example: 'Acto de graduación — Prof. Juan Pérez',
    description: 'Motivo visible de la reserva',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title: string;

  @ApiProperty({
    example: '2026-11-25T08:00:00Z',
    description: 'Inicio del período protegido (ISO 8601)',
  })
  @IsDateString()
  startAt: string;

  @ApiProperty({
    example: '2026-11-25T14:00:00Z',
    description: 'Fin del período protegido (ISO 8601)',
  })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({
    enum: ReservationType,
    default: ReservationType.VISITOR,
  })
  @IsOptional()
  @IsEnum(ReservationType)
  reservationType?: ReservationType;

  @ApiPropertyOptional({
    description:
      'Visitante externo al que se le reserva. Se gestiona en el Sprint 8.',
  })
  @IsOptional()
  @IsUUID()
  visitorId?: string;

  @ApiPropertyOptional({
    description:
      'Usuario de la universidad al que se le reserva. Solo él podrá ocupar el puesto durante el período (RN-005).',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ example: 'Llega por la entrada norte' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 4, default: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  priority?: number;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @IsString()
  @MaxLength(15)
  vehiclePlate?: string;

  @ApiPropertyOptional({ example: 'Toyota Corolla gris' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  vehicleDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

// `status` no se acepta: nace en CONFIRMED y solo cambia por las acciones
// /activate, /complete y /cancel, o por el job programado (sección 45).
