import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

/**
 * Consulta de auditoría (sección 14, pantalla A08). Solo ADMIN: la sección 7.2
 * incluye "consultar logs de auditoría" y la 7.1 no.
 *
 * Es de solo lectura a propósito: un registro de auditoría que se puede editar
 * o borrar no sirve como registro de auditoría.
 */
@ApiTags('Audit')
@ApiBearerAuth('access-token')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] Consultar la auditoría (CU-014)' })
  @ApiResponse({ status: 200, description: 'Registros paginados' })
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }

  @Get('actions')
  @ApiOperation({
    summary: '[ADMIN] Acciones registradas, para poblar el filtro',
  })
  @ApiResponse({ status: 200, description: 'Lista de acciones' })
  actions() {
    return this.auditService.distinctActions();
  }

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Detalle de un registro de auditoría' })
  @ApiResponse({ status: 200, description: 'Registro encontrado' })
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
