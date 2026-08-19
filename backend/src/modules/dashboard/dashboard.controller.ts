import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Dashboard administrativo (sección 22, pantalla A01). Solo ADMIN: la sección
 * 7.2 incluye "consultar dashboard" y la 7.1 no.
 */
@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: '[ADMIN] KPIs generales (CU-013)' })
  @ApiResponse({ status: 200, description: 'Resumen de ocupación' })
  summary() {
    return this.dashboardService.summary();
  }

  @Get('zones')
  @ApiOperation({ summary: '[ADMIN] Ocupación desglosada por zona' })
  @ApiResponse({ status: 200, description: 'Ocupación por zona' })
  zones() {
    return this.dashboardService.byZone();
  }

  @Get('occupancy')
  @ApiOperation({
    summary: '[ADMIN] Entradas por hora en las últimas 24 horas',
  })
  @ApiResponse({ status: 200, description: 'Serie horaria' })
  occupancy() {
    return this.dashboardService.occupancyByHour();
  }
}
