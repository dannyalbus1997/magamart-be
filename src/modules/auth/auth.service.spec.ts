import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    updateRefreshToken: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock-token'),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService,   useValue: mockUsersService },
        { provide: JwtService,     useValue: mockJwtService },
        { provide: ConfigService,  useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwtService.signAsync.mockResolvedValue('mock-token');
    mockConfigService.get.mockReturnValue('secret');
  });

  // ─── register ─────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws BadRequestException if email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({ email: 'test@test.com' });

      await expect(
        service.register({ email: 'test@test.com', password: 'pass', firstName: 'A', lastName: 'B' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores a bcrypt hash, never the plaintext password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockImplementation(async (dto: any) => ({
        id: 'user-id',
        email: dto.email,
        password: dto.password,
      }));
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      await service.register({ email: 'new@test.com', password: 'PlainText123', firstName: 'A', lastName: 'B' });

      const storedPassword = mockUsersService.create.mock.calls[0][0].password;
      expect(storedPassword).not.toBe('PlainText123');
      const isHashed = await bcrypt.compare('PlainText123', storedPassword);
      expect(isHashed).toBe(true);
    });
  });

  // ─── login ────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('throws UnauthorizedException when email is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'ghost@test.com', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      const hashed = await bcrypt.hash('CorrectPassword', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'u1', email: 'user@test.com', password: hashed, role: 'user',
      });

      await expect(
        service.login({ email: 'user@test.com', password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns tokens and user data on valid credentials', async () => {
      const hashed = await bcrypt.hash('Correct123', 10);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'u1', email: 'user@test.com', password: hashed,
        firstName: 'Alice', lastName: 'Smith', role: 'user',
      });
      mockUsersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.login({ email: 'user@test.com', password: 'Correct123' });

      expect(result.data).toHaveProperty('accessToken');
      expect(result.data).toHaveProperty('refreshToken');
      expect(result.data.user.email).toBe('user@test.com');
    });
  });
});
