import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class VisitorQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por institución o empresa',
    example: 'Universidad de Carabobo',
  })
  @IsOptional()
  @IsString()
  organization?: string;
}

// `search` lo aporta PaginationQueryDto y busca por nombre, cédula y placa.
