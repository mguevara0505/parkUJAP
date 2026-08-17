import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateParkingLotDto {
  @ApiProperty({
    example: 'Estacionamiento Principal',
    description: 'Nombre del estacionamiento físico',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'PRINCIPAL',
    description:
      'Código único e inmutable. Mayúsculas, números, guion y guion bajo',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'El código solo admite mayúsculas, números, guion y guion bajo',
  })
  code: string;

  @ApiPropertyOptional({ example: 'Estacionamiento frente al edificio A' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Av. Universidad, entrada principal' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// `totalSpaces` no se acepta desde el cliente: se deriva de los puestos reales
// para que no pueda quedar desincronizado (se mantiene a partir del Sprint 3).
