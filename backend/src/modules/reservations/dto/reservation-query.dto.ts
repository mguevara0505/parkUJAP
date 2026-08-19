import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReservationStatus, ReservationType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ReservationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por puesto' })
  @IsOptional()
  @IsUUID()
  parkingSpaceId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por visitante' })
  @IsOptional()
  @IsUUID()
  visitorId?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ enum: ReservationType })
  @IsOptional()
  @IsEnum(ReservationType)
  reservationType?: ReservationType;

  @ApiPropertyOptional({
    description: 'Reservas que terminan después de esta fecha',
    example: '2026-11-25T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Reservas que empiezan antes de esta fecha',
    example: '2026-11-26T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
