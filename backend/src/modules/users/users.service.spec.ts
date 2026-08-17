import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma/prisma.service';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const newUser = {
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'juan.perez@ujap.edu.ve',
  password: 'Clave1234',
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('hashea la contraseña y nunca la guarda en texto plano', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockImplementation(
        (args: { data: unknown }) => args.data,
      );

      await service.create(newUser);

      const calls = mockPrismaService.user.create.mock.calls as [
        { data: Record<string, unknown> },
      ][];
      const { data } = calls[0][0];
      expect(data.passwordHash).not.toBe(newUser.password);
      expect(data.passwordHash as string).toMatch(/^\$2[aby]\$/);
      expect(data).not.toHaveProperty('password');
      expect(data.role).toBe(Role.USER);
      expect(data.status).toBe(UserStatus.ACTIVE);
    });

    it('rechaza email duplicado con 409 Conflict', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'existente' });

      await expect(service.create(newUser)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('desactiva en lugar de borrar (soft-delete)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrismaService.user.update.mockResolvedValue({
        id: 'u1',
        email: 'u1@ujap.edu.ve',
        status: UserStatus.INACTIVE,
      });

      await service.remove('u1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: UserStatus.INACTIVE } }),
      );
    });
  });
});
