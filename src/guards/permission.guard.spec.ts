import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRepository } from '../repositories/system.repository';
import { PermissionGuard } from './permission.guard';

const principal = {
  status: 'ACTIVE' as const,
  isAdmin: false,
  organizationId: 1,
  permissions: ['tasks.read'],
};

describe('PermissionGuard', () => {
  it('rejects an effective principal missing a required permission', () => {
    const guard = new PermissionGuard({} as Reflector, {} as SystemRepository);

    expect(() => guard.assertPermissions(principal, ['tasks.create'])).toThrow(
      ForbiddenException,
    );
  });

  it('reloads effective permissions instead of trusting JWT claims', async () => {
    const repository = {
      listEffectivePermissions: jest.fn().mockResolvedValue(principal),
    };
    const guard = new PermissionGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(['tasks.create']),
      } as unknown as Reflector,
      repository as unknown as SystemRepository,
    );
    const context = contextWith({
      sub: 7,
      permissions: ['tasks.create'],
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.listEffectivePermissions).toHaveBeenCalledWith(7);
  });

  it('allows an ACTIVE ADMIN group without requiring every permission row', async () => {
    const repository = {
      listEffectivePermissions: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        isAdmin: true,
        permissions: [],
      }),
    };
    const guard = new PermissionGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(['users.manage']),
      } as unknown as Reflector,
      repository as unknown as SystemRepository,
    );

    await expect(guard.canActivate(contextWith({ sub: 1 }))).resolves.toBe(
      true,
    );
  });

  it('rejects a LOCKED ADMIN group', async () => {
    const repository = {
      listEffectivePermissions: jest.fn().mockResolvedValue({
        status: 'LOCKED',
        isAdmin: true,
        permissions: [],
      }),
    };
    const guard = new PermissionGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(['users.manage']),
      } as unknown as Reflector,
      repository as unknown as SystemRepository,
    );

    await expect(
      guard.canActivate(contextWith({ sub: 1 })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('removes a legacy staff claim while refreshing permissions', async () => {
    const repository = {
      listEffectivePermissions: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        isAdmin: false,
        organizationId: 22,
        permissions: ['tasks.read', 'tasks.read.all'],
      }),
    };
    const guard = new PermissionGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(['tasks.read']),
      } as unknown as Reflector,
      repository as unknown as SystemRepository,
    );
    const user = {
      sub: 7,
      organizationId: 10,
      permissions: [] as string[],
      isStaff: true,
    };

    await guard.canActivate(contextWith(user));

    expect(user).not.toHaveProperty('isStaff');
    expect(user).toEqual({
      sub: 7,
      organizationId: 22,
      permissions: ['tasks.read', 'tasks.read.all'],
      isAdmin: false,
    });
  });
});

function contextWith(user: Record<string, unknown>) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}
