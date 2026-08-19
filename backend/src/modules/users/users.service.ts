import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { Role, UserCategory, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;

// Campos que nunca se exponen en respuestas
const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  category: true,
  universityId: true,
  documentId: true,
  phone: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: false,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un nuevo usuario.
   * Sección 7 — Roles del sistema.
   * RN-012 — El email debe ser único.
   */
  async create(dto: CreateUserDto) {
    // Verificar email único
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`El correo ${dto.email} ya está registrado`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        passwordHash,
        role: dto.role ?? Role.USER,
        category: dto.category ?? UserCategory.STUDENT,
        universityId: dto.universityId,
        documentId: dto.documentId,
        phone: dto.phone,
        status: UserStatus.ACTIVE,
      },
      select: USER_SELECT,
    });

    this.logger.log(`Usuario creado: ${user.email} [${user.role}]`);
    return user;
  }

  /**
   * Lista usuarios con paginación y filtros.
   * Solo disponible para ADMIN — sección 7.2.
   */
  async findAll(query: UserQueryDto) {
    const { page = 1, limit = 20, search, role, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { universityId: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  /**
   * Obtiene un usuario por ID.
   */
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }

    return user;
  }

  /**
   * Actualiza datos de un usuario.
   * No actualiza contraseña (usa endpoint dedicado).
   */
  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id); // Verifica que existe

    // Si se cambia el email, verificar unicidad
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(`El correo ${dto.email} ya está en uso`);
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        role: dto.role,
        category: dto.category,
        universityId: dto.universityId,
        documentId: dto.documentId,
        phone: dto.phone,
        status: dto.status,
      },
      select: USER_SELECT,
    });

    this.logger.log(`Usuario actualizado: ${user.email}`);
    return user;
  }

  /**
   * Elimina un usuario (soft-delete vía status INACTIVE).
   */
  async remove(id: string) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
      select: USER_SELECT,
    });

    this.logger.log(`Usuario desactivado: ${user.email}`);
    return { message: 'Usuario desactivado correctamente', user };
  }

  /**
   * Cambia la contraseña de un usuario.
   */
  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }
}
