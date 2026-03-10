import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Permission } from '../users/entities/permission.entity';

export function createMockRole(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-uuid-1',
    slug: 'admin',
    name: 'Admin',
    users: [],
    ...overrides,
  } as Role;
}

export function createMockPermission(
  overrides: Partial<Permission> = {},
): Permission {
  return {
    id: 'perm-uuid-1',
    slug: 'processes_view',
    name: 'View Processes',
    ...overrides,
  } as Permission;
}

export function createMockUser(overrides: Partial<User> = {}): User {
  const role = createMockRole();
  return {
    id: 'user-uuid-1',
    login: 'testuser',
    email: 'test@test.com',
    passwordHash: '$2a$10$hashedpassword',
    displayName: 'Test User',
    isActive: true,
    roleId: role.id,
    role,
    permissions: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  } as User;
}
