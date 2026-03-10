import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import {
  createMockRepository,
  MockRepository,
} from '../test/mock-repository.factory';
import {
  createMockUser,
  createMockRole,
  createMockPermission,
} from '../test/mock-user.factory';

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: MockRepository;
  let roleRepo: MockRepository;
  let permissionRepo: MockRepository;

  beforeEach(async () => {
    userRepo = createMockRepository();
    roleRepo = createMockRepository();
    permissionRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Role), useValue: roleRepo },
        { provide: getRepositoryToken(Permission), useValue: permissionRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [createMockUser(), createMockUser({ id: 'user-2' })];
      userRepo.find!.mockResolvedValue(users);

      const result = await service.findAll();
      expect(result).toHaveLength(2);
      expect(userRepo.find).toHaveBeenCalledWith({
        relations: ['role', 'permissions'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      const user = createMockUser();
      userRepo.findOne!.mockResolvedValue(user);

      const result = await service.findOne('user-uuid-1');
      expect(result.id).toBe('user-uuid-1');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      userRepo.findOne!.mockResolvedValue(null); // no duplicate
      roleRepo.findOne!.mockResolvedValue(createMockRole());
      permissionRepo.findBy!.mockResolvedValue([]);
      userRepo.create!.mockImplementation((data: any) => data);
      userRepo.save!.mockImplementation((data: any) =>
        Promise.resolve({ id: 'new-uuid', ...data }),
      );

      const result = await service.create({
        login: 'newuser',
        password: 'password123',
        roleId: 'role-uuid-1',
      });

      expect(result.login).toBe('newuser');
      expect(result.passwordHash).toBeDefined();
      expect(userRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate login', async () => {
      userRepo.findOne!.mockResolvedValue(createMockUser());

      await expect(
        service.create({
          login: 'testuser',
          password: 'password123',
          roleId: 'role-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for invalid role', async () => {
      userRepo.findOne!.mockResolvedValue(null);
      roleRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.create({
          login: 'newuser',
          password: 'password123',
          roleId: 'bad-role',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user fields', async () => {
      const user = createMockUser();
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockImplementation((data: any) => Promise.resolve(data));

      const result = await service.update('user-uuid-1', {
        displayName: 'Updated Name',
      });

      expect(result.displayName).toBe('Updated Name');
    });

    it('should throw ConflictException for duplicate login on update', async () => {
      const user = createMockUser();
      const existingUser = createMockUser({ id: 'other-user', login: 'taken' });
      userRepo.findOne!
        .mockResolvedValueOnce(user) // findOne(id)
        .mockResolvedValueOnce(existingUser); // findByLogin duplicate check

      await expect(
        service.update('user-uuid-1', { login: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('changePassword', () => {
    it('should change password for admin without current password', async () => {
      const user = createMockUser();
      userRepo.findOne!.mockResolvedValue(user);
      userRepo.save!.mockImplementation((data: any) => Promise.resolve(data));

      await service.changePassword(
        'user-uuid-1',
        { newPassword: 'newpass123' } as any,
        true,
      );

      expect(userRepo.save).toHaveBeenCalled();
      const savedUser = (userRepo.save as jest.Mock).mock.calls[0][0];
      const isNewHash = await bcrypt.compare('newpass123', savedUser.passwordHash);
      expect(isNewHash).toBe(true);
    });

    it('should throw when non-admin provides wrong current password', async () => {
      const hash = await bcrypt.hash('currentpass', 10);
      const user = createMockUser({ passwordHash: hash });
      userRepo.findOne!.mockResolvedValue(user);

      await expect(
        service.changePassword(
          'user-uuid-1',
          { currentPassword: 'wrongpass', newPassword: 'newpass123' },
          false,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('seedRolesIfEmpty', () => {
    it('should seed roles when table is empty', async () => {
      roleRepo.count!.mockResolvedValue(0);
      roleRepo.save!.mockResolvedValue([]);

      await service.seedRolesIfEmpty();
      expect(roleRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'admin' }),
          expect.objectContaining({ slug: 'manager' }),
          expect.objectContaining({ slug: 'employee' }),
          expect.objectContaining({ slug: 'viewer' }),
        ]),
      );
    });

    it('should skip seeding when roles exist', async () => {
      roleRepo.count!.mockResolvedValue(4);
      await service.seedRolesIfEmpty();
      expect(roleRepo.save).not.toHaveBeenCalled();
    });
  });
});
