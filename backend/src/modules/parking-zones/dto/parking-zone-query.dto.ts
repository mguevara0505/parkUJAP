import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ParkingZoneQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estacionamiento' })
  @IsOptional()
  @IsUUID()
  parkingLotId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo' })
  @IsOptional()
  // El query string llega como 'true'/'false'; sin esto `false` sería truthy
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;
}
