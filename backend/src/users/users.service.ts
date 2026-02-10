import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  async findAll(): Promise<User[]> {
    return this.userRepo.find({
      relations: ['role', 'permissions'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'permissions'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { login },
      relations: ['role', 'permissions'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!email?.trim()) return null;
    return this.userRepo.findOne({
      where: { email: email.toLowerCase() },
      relations: ['role', 'permissions'],
    });
  }

  async getRoles(): Promise<Role[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async getPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByLogin(dto.login);
    if (existing) throw new ConflictException('User with this login already exists');
    if (dto.email?.trim()) {
      const byEmail = await this.findByEmail(dto.email);
      if (byEmail) throw new ConflictException('User with this email already exists');
    }
    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException('Role not found');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    let permissions: Permission[] = [];
    if (dto.permissionIds?.length) {
      permissions = await this.permissionRepo.findBy({ id: In(dto.permissionIds) });
    }

    const user = this.userRepo.create({
      login: dto.login,
      email: dto.email?.trim() ? dto.email.toLowerCase() : null,
      passwordHash,
      displayName: dto.displayName ?? '',
      roleId: dto.roleId,
      isActive: dto.isActive ?? true,
      permissions,
    });
    return this.userRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (dto.login !== undefined && dto.login !== user.login) {
      const existing = await this.findByLogin(dto.login);
      if (existing) throw new ConflictException('User with this login already exists');
      user.login = dto.login;
    }
    if (dto.email !== undefined) {
      const emailVal = dto.email?.trim() || null;
      if (emailVal && emailVal !== user.email) {
        const existing = await this.findByEmail(emailVal);
        if (existing) throw new ConflictException('User with this email already exists');
      }
      user.email = emailVal ? emailVal.toLowerCase() : null;
    }
    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.roleId) {
      const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found');
      user.roleId = dto.roleId;
    }
    if (dto.permissionIds !== undefined) {
      user.permissions = dto.permissionIds.length
        ? await this.permissionRepo.findBy({ id: In(dto.permissionIds) })
        : [];
    }
    return this.userRepo.save(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto, isAdmin = false): Promise<void> {
    const user = await this.findOne(userId);
    if (!isAdmin) {
      if (!dto.currentPassword?.trim())
        throw new ConflictException('Current password is required when changing your own password');
      if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash)))
        throw new ConflictException('Current password is incorrect');
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.userRepo.save(user);
  }

  async seedRolesIfEmpty(): Promise<void> {
    const count = await this.roleRepo.count();
    if (count > 0) return;
    await this.roleRepo.save([
      { slug: 'admin', name: 'Администратор' },
      { slug: 'manager', name: 'Руководитель' },
      { slug: 'employee', name: 'Сотрудник' },
      { slug: 'viewer', name: 'Наблюдатель' },
    ]);
  }

  async seedAdminIfConfigured(): Promise<void> {
    const login = process.env.SEED_ADMIN_LOGIN;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!login || !password) return;
    const userCount = await this.userRepo.count();
    if (userCount > 0) return;
    const adminRole = await this.roleRepo.findOne({ where: { slug: 'admin' } });
    if (!adminRole) return;
    const allPermissions = await this.permissionRepo.find();
    const email = process.env.SEED_ADMIN_EMAIL?.trim() || null;
    const passwordHash = await bcrypt.hash(password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        login,
        email: email ? email.toLowerCase() : null,
        passwordHash,
        displayName: 'Администратор',
        roleId: adminRole.id,
        isActive: true,
        permissions: allPermissions,
      }),
    );
    console.log('Seed admin user created:', login);
  }

  async seedPermissionsIfEmpty(): Promise<void> {
    const count = await this.permissionRepo.count();
    if (count > 0) return;
    await this.permissionRepo.save([
      { slug: 'agents', name: 'Агенты' },
      { slug: 'services', name: 'Сервисы' },
      { slug: 'hr', name: 'HR' },
      { slug: 'users', name: 'Пользователи' },
      { slug: 'screens', name: 'Настройка экранов' },
      { slug: 'bitrix24', name: 'Битрикс24' },
      { slug: 'calls', name: 'Звонки' },
      { slug: 'calls_manage_topics', name: 'Тематики звонков' },
      { slug: 'calls_settings', name: 'Настройки звонков' },
      { slug: 'calls_api_key', name: 'API ключ Polza.ai' },
    ]);
  }
}
