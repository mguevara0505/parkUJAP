import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SpaceStatus, SpaceType } from '@prisma/client';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** El query string llega como 'true'/'false'; sin esto `false` sería truthy. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' || value === true;

/**
 * Filtros del mapa y la disponibilidad (pantallas 03 y A02). Se definen una
 * sola vez y el listado administrativo los combina con la paginación.
 */
export class ParkingSpaceFiltersDto {
  @ApiPropertyOptional({ description: 'Filtrar por estacionamiento' })
  @IsOptional()
  @IsUUID()
  parkingLotId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por zona' })
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ enum: SpaceStatus })
  @IsOptional()
  @IsEnum(SpaceStatus)
  status?: SpaceStatus;

  @ApiPropertyOptional({ enum: SpaceType })
  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;

  @ApiPropertyOptional({ description: 'Solo puestos accesibles' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isAccessible?: boolean;

  @ApiPropertyOptional({ description: 'Solo puestos cubiertos' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isCovered?: boolean;

  @ApiPropertyOptional({
    description:
      'Prioridad máxima a incluir: 1 devuelve solo los mejores puestos (sección 17)',
    minimum: 1,
    maximum: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  maxPriority?: number;
}

/** Listado administrativo: los mismos filtros + paginación estándar (§30). */
export class ParkingSpaceQueryDto extends IntersectionType(
  ParkingSpaceFiltersDto,
  PaginationQueryDto,
) {}
