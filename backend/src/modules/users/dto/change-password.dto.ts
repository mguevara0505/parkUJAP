import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'User1234!', description: 'Contraseña actual' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'NuevaClave123',
    description: 'Nueva contraseña (mín. 8 caracteres, al menos 1 número)',
  })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/(?=.*\d)/, {
    message: 'La contraseña debe contener al menos un número',
  })
  newPassword: string;
}
