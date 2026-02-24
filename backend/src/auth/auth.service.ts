import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(login: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { login, isActive: true },
      relations: ['role', 'permissions'],
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.login, dto.password);
    if (!user) throw new UnauthorizedException('Invalid login or password');
    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto) {
    const stored = await this.refreshTokenRepo.findOne({
      where: { token: dto.refreshToken },
      relations: ['user', 'user.role', 'user.permissions'],
    });
    if (!stored || stored.expiresAt < new Date())
      throw new UnauthorizedException('Invalid or expired refresh token');
    await this.refreshTokenRepo.remove(stored);
    const user = stored.user;
    if (!user.isActive) throw new UnauthorizedException('User is inactive');
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokenRepo.delete({ token: refreshToken });
  }

  private async issueTokens(user: User) {
    const payload = { sub: user.id, login: user.login, email: user.email ?? undefined, role: user.role?.slug };
    const accessSecret = this.config.get<string>('JWT_ACCESS_SECRET', 'access-secret-change-me');
    const refreshSecret = this.config.get<string>('JWT_REFRESH_SECRET', 'refresh-secret-change-me');
    const accessExpires = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
    const refreshExpires = this.config.get<string>('JWT_REFRESH_EXPIRES', '7d');

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessExpires,
    });

    const refreshTokenValue = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { secret: refreshSecret, expiresIn: refreshExpires },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.refreshTokenRepo.save(
      this.refreshTokenRepo.create({
        token: refreshTokenValue,
        userId: user.id,
        expiresAt,
      }),
    );

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresIn: accessExpires,
      user: {
        id: user.id,
        login: user.login,
        email: user.email ?? undefined,
        displayName: user.displayName,
        role: user.role?.slug,
        permissions: user.permissions?.map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
        })) || [],
      },
    };
  }
}
