import {
  Body,
  Controller,
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
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceBlockDto } from './dto/create-maintenance-block.dto';
import { UpdateMaintenanceBlockDto } from './dto/update-maintenance-block.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Bloqueos y mantenimiento (sección 13). Todo el módulo es ADMIN: la sección
 * 7.2 incluye "bloquear puestos por mantenimiento" y la 7.1 no.
 */
@ApiTags('Maintenance')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('maintenance-blocks')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post()
  @ApiOperation({
    summary: '[ADMIN] Bloquear un puesto (CU-009)',
    description:
      'RN-009: inicio y fin obligatorios. RN-010: si empieza ya, el puesto pasa a MAINTENANCE en el acto.',
  })
  @ApiResponse({ status: 201, description: 'Bloqueo creado' })
  @ApiResponse({ status: 404, description: 'El puesto no existe' })
  @ApiResponse({ status: 409, description: 'Rango de fechas inválido' })
  create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateMaintenanceBlockDto,
  ) {
    return this.maintenanceService.create(adminId, dto);
  }

  @Get()
  @ApiOperation({ summary: '[ADMIN] Listar bloqueos (pantalla A06)' })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  findAll(@Query() query: MaintenanceQueryDto) {
    return this.maintenanceService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Detalle de un bloqueo' })
  @ApiResponse({ status: 200, description: 'Bloqueo encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Editar un bloqueo' })
  @ApiResponse({ status: 200, description: 'Bloqueo actualizado' })
  @ApiResponse({ status: 409, description: 'El bloqueo ya está cerrado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMaintenanceBlockDto,
  ) {
    return this.maintenanceService.update(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Cancelar un bloqueo' })
  @ApiResponse({ status: 200, description: 'Bloqueo cancelado' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.cancel(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Dar por terminado el mantenimiento (CU-010)',
    description: 'Reactiva el puesto antes de la fecha de fin prevista.',
  })
  @ApiResponse({ status: 200, description: 'Bloqueo completado' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.complete(id);
  }
}
