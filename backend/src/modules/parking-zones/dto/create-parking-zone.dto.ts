import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserCategory } from '@prisma/client';

export class CreateParkingZoneDto {
  @ApiProperty({
    example: '1f4d2c1e-0000-4000-8000-000000000000',
    description: 'Estacionamiento al que pertenece la zona',
  })
  @IsUUID()
  parkingLotId: string;

  @ApiProperty({ example: 'Zona A', description: 'Nombre visible de la zona' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'A',
    description:
      'Código único. Prefija los códigos de puesto de la zona (A-001, A-002...)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'El código solo admite mayúsculas, números, guion y guion bajo',
  })
  code: string;

  @ApiPropertyOptional({ example: 'Zona cubierta más cercana al edificio A' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 1, description: 'Piso o nivel', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-5)
  @Max(50)
  floor?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Orden de aparición en el mapa y los listados',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: UserCategory,
    isArray: true,
    description:
      'Categorías que pueden estacionarse aquí por su cuenta. Una lista vacía significa "solo por reserva administrativa" (autoridades, proveedores, eventos).',
    example: [UserCategory.STUDENT],
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserCategory, { each: true })
  allowedCategories?: UserCategory[];
}
