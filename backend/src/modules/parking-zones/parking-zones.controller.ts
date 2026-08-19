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
import { ParkingZonesService } from './parking-zones.service';
import { CreateParkingZoneDto } from './dto/create-parking-zone.dto';
import { UpdateParkingZoneDto } from './dto/update-parking-zone.dto';
import { ParkingZoneQueryDto } from './dto/parking-zone-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Lectura: cualquier usuario autenticado (sección 7.1 — "ver zonas disponibles").
 * Escritura: solo ADMIN (sección 7.2 — CU-011 administrar zonas).
 */
@ApiTags('Parking Zones')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Controller('parking-zones')
export class ParkingZonesController {
  constructor(private readonly parkingZonesService: ParkingZonesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Crear zona' })
  @ApiResponse({ status: 201, description: 'Zona creada' })
  @ApiResponse({ status: 404, description: 'Estacionamiento no encontrado' })
  @ApiResponse({ status: 409, description: 'El código ya está registrado' })
  create(@Body() dto: CreateParkingZoneDto) {
    return this.parkingZonesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar zonas con paginación y filtros' })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  findAll(@Query() query: ParkingZoneQueryDto) {
    return this.parkingZonesService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener zona por ID' })
  @ApiResponse({ status: 200, description: 'Zona encontrada' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.parkingZonesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Actualizar zona' })
  @ApiResponse({ status: 200, description: 'Zona actualizada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParkingZoneDto,
  ) {
    return this.parkingZonesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Desactivar zona (soft-delete)' })
  @ApiResponse({ status: 200, description: 'Zona desactivada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.parkingZonesService.remove(id);
  }
}
