import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { AuditQueryDto } from './dto/audit-query.dto';

/**
 * Campos que jamás deben quedar escritos en la auditoría (sección 32).
 * La comparación es por nombre exacto en minúsculas.
 */
const REDACTED_FIELDS = new Set([
  'password',
  'currentpassword',
  'newpassword',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
]);

export interface AuditEntry {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una acción. Nunca lanza: una auditoría que falla no puede tumbar
   * la operación del usuario, pero sí debe dejar rastro en el log del servidor
   * para que el fallo se note.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          oldValue: this.sanitize(entry.oldValue),
          newValue: this.sanitize(entry.newValue),
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent?.slice(0, 500),
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${entry.action}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Sustituye por '[oculto]' cualquier campo sensible, a cualquier
   * profundidad. Sección 32: no registrar contraseñas ni tokens.
   */
  private sanitize(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined || value === null) return undefined;

    const walk = (input: unknown): unknown => {
      if (Array.isArray(input)) return input.map(walk);

      if (input && typeof input === 'object') {
        return Object.fromEntries(
          Object.entries(input as Record<string, unknown>).map(([k, v]) =>
            REDACTED_FIELDS.has(k.toLowerCase())
              ? [k, '[oculto]']
              : [k, walk(v)],
          ),
        );
      }

      return input;
    };

    return walk(value) as Prisma.InputJsonValue;
  }

  /** Pantalla A08 — consulta de auditoría. */
  async findAll(query: AuditQueryDto) {
    const { page = 1, limit = 20, search } = query;

    const where: Prisma.AuditLogWhereInput = {
      ...(query.userId && { userId: query.userId }),
      ...(query.action && { action: query.action }),
      ...(query.entityType && { entityType: query.entityType }),
      ...(query.entityId && { entityId: query.entityId }),
      ...(query.from && { createdAt: { gte: new Date(query.from) } }),
      ...(query.to && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          lte: new Date(query.to),
        },
      }),
      ...(search && {
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { entityType: { contains: search, mode: 'insensitive' } },
          {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  /** Acciones distintas ya registradas, para poblar el filtro de la pantalla. */
  async distinctActions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
