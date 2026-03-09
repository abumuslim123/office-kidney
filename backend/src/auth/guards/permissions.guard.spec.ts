import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  function mockContext(permissionSlugs: string[]): ExecutionContext {
    return {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            permissions: permissionSlugs.map((slug) => ({
              id: `perm-${slug}`,
              slug,
              name: slug,
            })),
          },
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow when no permissions required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext([]))).toBe(true);
  });

  it('should allow when user has all required permissions', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValueOnce(['processes_view']) // class-level
      .mockReturnValueOnce(['processes_edit']); // method-level
    expect(
      guard.canActivate(mockContext(['processes_view', 'processes_edit'])),
    ).toBe(true);
  });

  it('should deny when user lacks a required permission', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValueOnce(['processes_view'])
      .mockReturnValueOnce(['processes_approve']);
    expect(
      guard.canActivate(mockContext(['processes_view'])),
    ).toBe(false);
  });

  it('should deny when user has no permissions', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValueOnce(['hr'])
      .mockReturnValueOnce([]);

    const ctx = {
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { permissions: [] },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('should deduplicate class and method permissions', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValueOnce(['processes_view'])
      .mockReturnValueOnce(['processes_view']); // duplicate
    expect(guard.canActivate(mockContext(['processes_view']))).toBe(true);
  });
});
