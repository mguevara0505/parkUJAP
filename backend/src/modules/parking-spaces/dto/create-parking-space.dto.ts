import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SpaceType } from '@prisma/client';

export class CreateParkingSpaceDto {
  @ApiProperty({ description: 'Zona a la que pertenece el puesto' })
  @IsUUID()
  zoneId: string;

  @ApiProperty({
    example: 'A-001',
    description: 'Código único del puesto, normalmente ZONA-NÚMERO',
  })
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'El código solo admite mayúsculas, números y guion',
  })
  code: string;

  @ApiProperty({
    example: 1,
    description: 'Número del puesto dentro de la zona',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number: number;

  @ApiPropertyOptional({ enum: SpaceType, default: SpaceType.STANDARD })
  @IsOptional()
  @IsEnum(SpaceType)
  type?: SpaceType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAccessible?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCovered?: boolean;

  @ApiPropertyOptional({
    example: 3,
    description: '1 = máxima prioridad, 4 = baja (sección 17)',
    default: 3,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  priority?: number;

  // ── Geometría para el mapa (sección 19) ──────────────────
  @ApiPropertyOptional({
    example: 100,
    description: 'Coordenada X en el plano',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  positionX?: number;

  @ApiPropertyOptional({
    example: 250,
    description: 'Coordenada Y en el plano',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  positionY?: number;

  @ApiPropertyOptional({ example: 60, default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Rotación en grados, para puestos en diagonal',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-360)
  @Max(360)
  rotation?: number;
}

// `status` no se acepta al crear: todo puesto nuevo nace AVAILABLE.
