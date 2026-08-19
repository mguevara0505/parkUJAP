import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Normaliza a mayúsculas sin espacios sobrantes: placas y cédulas. */
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVisitorDto {
  @ApiProperty({ example: 'Juan' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({
    example: 'V-12345678',
    description:
      'Cédula o documento. Único: identifica al visitante cuando vuelve.',
  })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(20)
  documentId?: string;

  @ApiPropertyOptional({ example: 'juan.perez@ejemplo.com' })
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email?: string;

  @ApiPropertyOptional({ example: '+58412-1234567' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: 'Universidad de Carabobo',
    description: 'Institución o empresa a la que representa',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  organization?: string;

  // ── Vehículo (sección 12) ────────────────────────────────
  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @Transform(upper)
  @IsString()
  @MaxLength(15)
  @Matches(/^[A-Z0-9-]*$/, {
    message: 'La placa solo admite letras, números y guion',
  })
  vehiclePlate?: string;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  vehicleBrand?: string;

  @ApiPropertyOptional({ example: 'Corolla' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  vehicleModel?: string;

  @ApiPropertyOptional({ example: 'Gris' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  vehicleColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
