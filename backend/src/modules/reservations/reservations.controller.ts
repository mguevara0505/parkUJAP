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
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ReservationQueryDto } from './dto/reservation-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Reservas anticipadas (sección 11). Todo el módulo es ADMIN: la sección 7.1
 * dice explícitamente que un USER no puede reservar puestos para terceros, y
 * el alcance de la versión 1 excluye la reserva autónoma (sección 3).
 */
@ApiTags('Reservations')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({
    summary: '[ADMIN] Crear reserva anticipada',
    description:
      'RN-006: PostgreSQL rechaza cualquier solapamiento con otra reserva vigente del mismo puesto. Las reservas consecutivas sí se permiten (sección 44).',
  })
  @ApiResponse({ status: 201, description: 'Reserva creada' })
  @ApiResponse({ status: 404, description: 'El puesto no existe' })
  @ApiResponse({ status: 409, description: 'Solapamiento o rango inválido' })
  create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(adminId, dto);
  }

  @Get()
  @ApiOperation({
    summary: '[ADMIN] Listar reservas con filtros y búsqueda (pantalla A04)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  findAll(@Query() query: ReservationQueryDto) {
    return this.reservationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Detalle de una reserva' })
  @ApiResponse({ status: 200, description: 'Reserva encontrada' })
  @ApiResponse({ status: 404, description: 'No encontrada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Editar una reserva' })
  @ApiResponse({ status: 200, description: 'Reserva actualizada' })
  @ApiResponse({ status: 409, description: 'Solapamiento o reserva cerrada' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Cancelar una reserva (RN-007)' })
  @ApiResponse({ status: 200, description: 'Reserva cancelada' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.cancel(id);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Activar una reserva',
    description: 'El job programado lo hace solo al llegar la hora de inicio.',
  })
  @ApiResponse({ status: 200, description: 'Reserva activada' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.activate(id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Marcar una reserva como completada' })
  @ApiResponse({ status: 200, description: 'Reserva completada' })
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.complete(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Cancelar una reserva (alias de /cancel)',
    description:
      'Una reserva nunca se borra: queda cancelada para conservar la trazabilidad (sección 2).',
  })
  @ApiResponse({ status: 200, description: 'Reserva cancelada' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.cancel(id);
  }
}
