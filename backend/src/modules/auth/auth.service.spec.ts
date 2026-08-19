import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { UserStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-id-123',
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'juan@ujap.edu.ve',
  passwordHash: '$2b$12$hashedpassword',
  role: Role.USER,
  status: UserStatus.ACTIVE,
  universityId: '2023-001',
  documentId: null,
  phone: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mocked-token'),
  verify: jest.fn(),
  decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 604800 })),
};

const mockConfigService = {
  get: jest.fn((key: string, defaultVal?: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_SECRET: 'test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_ACCESS_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
    };
    return map[key] ?? defaultVal;
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('lanza UnauthorizedException si el usuario no existe', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('noexiste@ujap.edu.ve', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lanza UnauthorizedException si la cuenta está inactiva', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(
        service.validateUser(mockUser.email, 'Admin1234!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    // Hash real de 'Correcta123' para ejercitar bcrypt.compare de verdad
    const PASSWORD = 'Correcta123';

    beforeEach(async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: await bcrypt.hash(PASSWORD, 4),
      });
    });

    it('retorna access token, refresh token y usuario sin passwordHash', async () => {
      const result = await service.login({
        email: mockUser.email,
        password: PASSWORD,
      });

      expect(result.accessToken).toBe('mocked-token');
      expect(result.refreshToken).toBe('mocked-token');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });

    it('lanza UnauthorizedException con contraseña incorrecta', async () => {
      await expect(
        service.login({ email: mockUser.email, password: 'Incorrecta123' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrismaService.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('retorna el perfil del usuario autenticado', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.me(mockUser.id);
      expect(result).toBeDefined();
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockUser.id } }),
      );
    });
  });

  describe('logout', () => {
    it('elimina todos los refresh tokens si no se proporciona token específico', async () => {
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.logout(mockUser.id);
      expect(result).toEqual({ message: 'Sesión cerrada correctamente' });
      expect(mockPrismaService.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
    });
  });
});
