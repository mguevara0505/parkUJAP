import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'Juan', description: 'Nombre' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Pérez', description: 'Apellido' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    example: 'juan.perez@ujap.edu.ve',
    description: 'Correo electrónico',
  })
  @IsEmail({}, { message: 'Correo electrónico inválido' })
  email: string;

  @ApiProperty({
    example: 'Admin1234!',
    description: 'Contraseña (mín. 8 caracteres, al menos 1 número)',
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?=.*\d)/, {
    message: 'La contraseña debe contener al menos un número',
  })
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.USER })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ example: '2024-001', description: 'ID universitario' })
  @IsOptional()
  @IsString()
  universityId?: string;

  @ApiPropertyOptional({
    example: 'V-12345678',
    description: 'Cédula o documento',
  })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ example: '+58412-1234567' })
  @IsOptional()
  @IsString()
  phone?: string;
}
