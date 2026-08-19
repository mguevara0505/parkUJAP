import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { ParkingSessionsService } from './parking-sessions.service';
import { CheckInDto } from './dto/check-in.dto';
import { SessionQueryDto } from './dto/session-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Registro de ocupación (sección 10).
 *
 * Las rutas literales /me/* van antes de las que llevan :id.
 */
@ApiTags('Parking Sessions')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Controller('parking-sessions')
export class ParkingSessionsController {
  constructor(private readonly sessionsService: ParkingSessionsService) {}

  @Post('check-in')
  @ApiOperation({
    summary: 'Registrar que se estacionó en un puesto',
    description:
      'Operación transaccional y atómica (secciones 14 y 25). Si dos usuarios intentan el mismo puesto a la vez, solo uno recibe 201 y el otro 409.',
  })
  @ApiResponse({ status: 201, description: 'Ocupación registrada' })
  @ApiResponse({ status: 404, description: 'El puesto no existe' })
  @ApiResponse({
    status: 409,
    description:
      'El puesto ya no está disponible, o el usuario ya tiene una sesión activa',
  })
  checkIn(@CurrentUser('id') userId: string, @Body() dto: CheckInDto) {
    return this.sessionsService.checkIn(userId, dto);
  }

  @Get('me/active')
  @ApiOperation({ summary: 'Consultar el estacionamiento activo propio' })
  @ApiResponse({ status: 200, description: 'Sesión activa, o null' })
  findMyActive(@CurrentUser('id') userId: string) {
    return this.sessionsService.findMyActive(userId);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Historial personal de estacionamientos' })
  @ApiResponse({ status: 200, description: 'Historial paginado' })
  findMyHistory(
    @CurrentUser('id') userId: string,
    @Query() query: SessionQueryDto,
  ) {
    return this.sessionsService.findMyHistory(userId, query);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Historial completo de ocupaciones' })
  @ApiResponse({ status: 200, description: 'Historial paginado' })
  findAll(@Query() query: SessionQueryDto) {
    return this.sessionsService.findAll(query);
  }

  @Post(':id/check-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liberar el puesto',
    description:
      'El dueño de la sesión, o un ADMIN para liberar administrativamente (pantalla A03).',
  })
  @ApiResponse({ status: 200, description: 'Puesto liberado' })
  @ApiResponse({ status: 403, description: 'La sesión es de otro usuario' })
  @ApiResponse({ status: 409, description: 'La sesión ya estaba cerrada' })
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.sessionsService.checkOut(id, userId, role);
  }
}
