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
import { ParkingLotsService } from './parking-lots.service';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { UpdateParkingLotDto } from './dto/update-parking-lot.dto';
import { ParkingLotQueryDto } from './dto/parking-lot-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Lectura: cualquier usuario autenticado (sección 7.1 — "ver estacionamientos").
 * Escritura: solo ADMIN (sección 7.2 — "crear estacionamientos").
 */
@ApiTags('Parking Lots')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Controller('parking-lots')
export class ParkingLotsController {
  constructor(private readonly parkingLotsService: ParkingLotsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Crear estacionamiento' })
  @ApiResponse({ status: 201, description: 'Estacionamiento creado' })
  @ApiResponse({ status: 409, description: 'El código ya está registrado' })
  create(@Body() dto: CreateParkingLotDto) {
    return this.parkingLotsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar estacionamientos con paginación y filtros' })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  findAll(@Query() query: ParkingLotQueryDto) {
    return this.parkingLotsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener estacionamiento con sus zonas' })
  @ApiResponse({ status: 200, description: 'Estacionamiento encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.parkingLotsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Actualizar estacionamiento' })
  @ApiResponse({ status: 200, description: 'Estacionamiento actualizado' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParkingLotDto,
  ) {
    return this.parkingLotsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Desactivar estacionamiento (soft-delete)',
  })
  @ApiResponse({ status: 200, description: 'Estacionamiento desactivado' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.parkingLotsService.remove(id);
  }
}
