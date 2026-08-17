import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { VisitorsService } from './visitors.service';
import { CreateVisitorDto } from './dto/create-visitor.dto';
import { UpdateVisitorDto } from './dto/update-visitor.dto';
import { VisitorQueryDto } from './dto/visitor-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Visitantes externos (sección 12). Todo el módulo es ADMIN: la sección 7.2
 * incluye "crear visitantes" entre sus permisos y la 7.1 no.
 */
@ApiTags('Visitors')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('visitors')
export class VisitorsController {
  constructor(private readonly visitorsService: VisitorsService) {}

  @Post()
  @ApiOperation({ summary: '[ADMIN] Crear visitante (CU-008)' })
  @ApiResponse({ status: 201, description: 'Visitante creado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un visitante con ese documento',
  })
  create(@Body() dto: CreateVisitorDto) {
    return this.visitorsService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: '[ADMIN] Listar visitantes (pantalla A05)',
    description: 'La búsqueda cubre nombre, cédula, placa e institución.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  findAll(@Query() query: VisitorQueryDto) {
    return this.visitorsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: '[ADMIN] Detalle del visitante con su historial de reservas',
  })
  @ApiResponse({ status: 200, description: 'Visitante encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.visitorsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: '[ADMIN] Actualizar visitante o registrar su vehículo',
  })
  @ApiResponse({ status: 200, description: 'Visitante actualizado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitorDto,
  ) {
    return this.visitorsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Eliminar visitante sin historial',
    description:
      'Un visitante con reservas no se elimina: su historial forma parte de la trazabilidad de quién estuvo en el campus.',
  })
  @ApiResponse({ status: 200, description: 'Visitante eliminado' })
  @ApiResponse({ status: 409, description: 'El visitante tiene reservas' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.visitorsService.remove(id);
  }
}
