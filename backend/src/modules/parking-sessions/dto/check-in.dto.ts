import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SessionSource } from '@prisma/client';

export class CheckInDto {
  @ApiProperty({ description: 'Puesto donde el usuario se estacionó' })
  @IsUUID()
  parkingSpaceId: string;

  @ApiPropertyOptional({
    enum: SessionSource,
    default: SessionSource.WEB,
    description: 'Origen del registro. La app móvil enviará MOBILE.',
  })
  @IsOptional()
  @IsEnum(SessionSource)
  source?: SessionSource;

  @ApiPropertyOptional({ example: 'Cerca de la entrada norte' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
