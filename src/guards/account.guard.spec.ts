import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { AuthRepository } from '../repositories/auth.repository';
import { AccountGuard } from './account.guard';

const activeUser = {
  id: 7,
  organizationId: 22,
  status: UserStatus.ACTIVE,
};

const normalPrincipal = {
  sub: 7,
  username: 'user',
  organizationId: 99,
  isAdmin: false,
};

describe('AccountGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let repository: { findUserById: jest.Mock };
  let guard: AccountGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    repository = { findUserById: jest.fn() };
    guard = new AccountGuard(
      reflector as unknown as Reflector,
      repository as unknown as AuthRepository,
    );
  });

  it('reloads organization and derives admin only from user id 1', async () => {
    repository.findUserById.mockResolvedValue({
      ...activeUser,
      id: 1,
      organizationId: 22,
    });
    const principal = {
      sub: 1,
      username: 'admin',
      organizationId: 99,
      isAdmin: false,
    };

    await guard.canActivate(contextWith(principal));

    expect(principal).toMatchObject({ organizationId: 22, isAdmin: true });
  });

  it.each([null, { ...activeUser, status: 'LOCKED' }])(
    'rejects a missing or inactive current account',
    async (user) => {
      repository.findUserById.mockResolvedValue(user);
      await expect(
        guard.canActivate(contextWith(normalPrincipal)),
      ).rejects.toMatchObject({
        status: 403,
      });
    },
  );

  it('rejects a normal user on an admin-only controller', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    repository.findUserById.mockResolvedValue(activeUser);
    await expect(
      guard.canActivate(contextWith(normalPrincipal)),
    ).rejects.toMatchObject({
      status: 403,
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
