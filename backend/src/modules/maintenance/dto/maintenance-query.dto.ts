import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MaintenanceReason, MaintenanceStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class MaintenanceQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por puesto' })
  @IsOptional()
  @IsUUID()
  parkingSpaceId?: string;

  @ApiPropertyOptional({ enum: MaintenanceStatus })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ enum: MaintenanceReason })
  @IsOptional()
  @IsEnum(MaintenanceReason)
  reason?: MaintenanceReason;

  @ApiPropertyOptional({
    description: 'Bloqueos que terminan después de esta fecha',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Bloqueos que empiezan antes de esta fecha',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
