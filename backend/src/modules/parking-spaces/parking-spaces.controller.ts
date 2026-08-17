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
import { ParkingSpacesService } from './parking-spaces.service';
import { CreateParkingSpaceDto } from './dto/create-parking-space.dto';
import { UpdateParkingSpaceDto } from './dto/update-parking-space.dto';
import {
  ParkingSpaceFiltersDto,
  ParkingSpaceQueryDto,
} from './dto/parking-space-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Lectura: cualquier usuario autenticado (sección 7.1 — ver mapa y
 * disponibilidad). Escritura: solo ADMIN (sección 7.2).
 *
 * IMPORTANTE: las rutas literales (/available, /map, /code/:code) van antes de
 * /:id. Nest resuelve en orden de declaración y ':id' capturaría "map",
 * haciendo que ParseUUIDPipe responda 400.
 */
@ApiTags('Parking Spaces')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Controller('parking-spaces')
export class ParkingSpacesController {
  constructor(private readonly parkingSpacesService: ParkingSpacesService) {}

  @Get('available')
  @ApiOperation({
    summary: 'Puestos disponibles ahora, ordenados por prioridad',
    description:
      'Excluye DISABLED y MAINTENANCE (RN-003, RN-004) y los puestos de zonas o estacionamientos desactivados.',
  })
  @ApiResponse({ status: 200, description: 'Puestos disponibles' })
  findAvailable(@Query() filters: ParkingSpaceFiltersDto) {
    return this.parkingSpacesService.findAvailable(filters);
  }

  @Get('map')
  @ApiOperation({
    summary: 'Datos del mapa: puestos, zonas y límites del plano',
    description:
      'Respuesta reducida a los campos necesarios para dibujar (sección 19). Sin paginar.',
  })
  @ApiResponse({ status: 200, description: 'Mapa del estacionamiento' })
  findForMap(@Query() filters: ParkingSpaceFiltersDto) {
    return this.parkingSpacesService.findForMap(filters);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Buscar un puesto por su código (A-001)' })
  @ApiResponse({ status: 200, description: 'Puesto encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findByCode(@Param('code') code: string) {
    return this.parkingSpacesService.findByCode(code);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Crear puesto' })
  @ApiResponse({ status: 201, description: 'Puesto creado' })
  @ApiResponse({ status: 404, description: 'Zona no encontrada' })
  @ApiResponse({ status: 409, description: 'El código ya está registrado' })
  create(@Body() dto: CreateParkingSpaceDto) {
    return this.parkingSpacesService.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar puestos con paginación, filtros y búsqueda',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  findAll(@Query() query: ParkingSpaceQueryDto) {
    return this.parkingSpacesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un puesto (pantalla A03)' })
  @ApiResponse({ status: 200, description: 'Puesto encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.parkingSpacesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: '[ADMIN] Actualizar puesto',
    description:
      'El estado admite solo AVAILABLE, DISABLED o MAINTENANCE. OCCUPIED y RESERVED los gestionan las sesiones y las reservas.',
  })
  @ApiResponse({ status: 200, description: 'Puesto actualizado' })
  @ApiResponse({ status: 400, description: 'Estado no permitido' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParkingSpaceDto,
  ) {
    return this.parkingSpacesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Deshabilitar puesto (pasa a DISABLED)' })
  @ApiResponse({ status: 200, description: 'Puesto deshabilitado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.parkingSpacesService.remove(id);
  }
}
