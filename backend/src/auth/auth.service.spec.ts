import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import {
  createMockRepository,
  MockRepository,
} from '../test/mock-repository.factory';
import { createMockUser } from '../test/mock-user.factory';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: MockRepository;
  let refreshTokenRepo: MockRepository;
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    userRepo = createMockRepository();
    refreshTokenRepo = createMockRepository();
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepo },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultVal: string) => defaultVal),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const user = createMockUser({ passwordHash: hash });
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.validateUser('testuser', 'password123');
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      const result = await service.validateUser('nonexistent', 'password');
      expect(result).toBeNull();
    });

    it('should return null when password is wrong', async () => {
      const hash = await bcrypt.hash('correct', 10);
      const user = createMockUser({ passwordHash: hash });
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.validateUser('testuser', 'wrong');
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(
        service.login({ login: 'bad', password: 'bad' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const user = createMockUser({ passwordHash: hash });
      userRepo.findOne!.mockResolvedValue(user);
      refreshTokenRepo.create!.mockImplementation((e: any) => e);
      refreshTokenRepo.save!.mockResolvedValue({});

      const result = await service.login({
        login: 'testuser',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.user.login).toBe('testuser');
      expect(result.user.id).toBe('user-uuid-1');
    });
  });

  describe('refresh', () => {
    it('should throw when refresh token not found', async () => {
      refreshTokenRepo.findOne!.mockResolvedValue(null);
      await expect(
        service.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when refresh token expired', async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);
      refreshTokenRepo.findOne!.mockResolvedValue({
        token: 'expired-token',
        expiresAt: expiredDate,
        user: createMockUser(),
      });

      await expect(
        service.refresh({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user is inactive', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const inactiveUser = createMockUser({ isActive: false });
      refreshTokenRepo.findOne!.mockResolvedValue({
        token: 'valid-token',
        expiresAt: futureDate,
        user: inactiveUser,
      });
      refreshTokenRepo.remove!.mockResolvedValue({});

      await expect(
        service.refresh({ refreshToken: 'valid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should issue new tokens for valid refresh', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const user = createMockUser();
      refreshTokenRepo.findOne!.mockResolvedValue({
        token: 'valid-token',
        expiresAt: futureDate,
        user,
      });
      refreshTokenRepo.remove!.mockResolvedValue({});
      refreshTokenRepo.create!.mockImplementation((e: any) => e);
      refreshTokenRepo.save!.mockResolvedValue({});

      const result = await service.refresh({ refreshToken: 'valid-token' });
      expect(result.accessToken).toBe('mock-token');
      expect(result.user.id).toBe('user-uuid-1');
    });
  });

  describe('logout', () => {
    it('should delete refresh token', async () => {
      refreshTokenRepo.delete!.mockResolvedValue({ affected: 1 });
      await service.logout('some-token');
      expect(refreshTokenRepo.delete).toHaveBeenCalledWith({
        token: 'some-token',
      });
    });
  });
});
