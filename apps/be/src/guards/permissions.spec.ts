import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AuthRepository } from '../repositories/auth.repository';
import { AccountGuard } from './account.guard';
import { RoleGuard } from './role.guard';

const context = (user: object) => ({
  getHandler: () => null,
  getClass: () => null,
  switchToHttp: () => ({ getRequest: () => ({ user }) }),
});

describe('database staff permissions', () => {
  const reflector = (permission: string) => ({
    getAllAndOverride: (key: string) => key === 'permissions' ? [permission] : undefined,
  }) as unknown as Reflector;

  it('allows MANAGE to VIEW but does not let MANAGE SCORE', () => {
    const user = { role: Role.ADMIN, staffPermissions: ['MANAGE'] };
    expect(new RoleGuard(reflector('VIEW')).canActivate(context(user) as never)).toBe(true);
    expect(() => new RoleGuard(reflector('SCORE')).canActivate(context(user) as never)).toThrow(ForbiddenException);
  });

  it('does not infer permissions from a legacy role or permit registrant staff privileges', () => {
    for (const user of [
      { role: Role.ADMIN, staffPermissions: [] },
      { role: Role.REGISTRANT, staffPermissions: ['MANAGE', 'SCORE'] },
    ]) {
      expect(() => new RoleGuard(reflector('MANAGE')).canActivate(context(user) as never)).toThrow(ForbiddenException);
    }
  });

  it('allows combined permissions while preserving REGISTRANT-only routes', () => {
    for (const staffPermissions of [['MANAGE', 'SCORE'], ['VIEW', 'SCORE']]) {
      const user = { role: Role.ADMIN, staffPermissions };
      expect(new RoleGuard(reflector('VIEW')).canActivate(context(user) as never)).toBe(true);
      expect(new RoleGuard(reflector('SCORE')).canActivate(context(user) as never)).toBe(true);
    }
    const registrantOnly = { getAllAndOverride: (key: string) => key === 'roles' ? [Role.REGISTRANT] : undefined } as unknown as Reflector;
    expect(() => new RoleGuard(registrantOnly).canActivate(context({ role: Role.ADMIN, staffPermissions: ['MANAGE', 'SCORE'] }) as never)).toThrow(ForbiddenException);
    expect(new RoleGuard(registrantOnly).canActivate(context({ role: Role.REGISTRANT, staffPermissions: [] }) as never)).toBe(true);
  });

  it('replaces token permissions and unit with current DB values', async () => {
    const token = { sub: 'u', role: Role.ADMIN, email: 'old', tokenVersion: 3, staffPermissions: ['MANAGE'], organizationUnitId: 'old' };
    const repository = { findUserById: jest.fn().mockResolvedValue({
      role: Role.JUDGE, email: 'current', verified: true, isActive: true, tokenVersion: 3,
      staffPermissions: ['SCORE'], organizationUnitId: 'unit', organizationUnit: { id: 'unit', code: 'U', name: 'Unit' },
    }) };
    await new AccountGuard(repository as unknown as AuthRepository).canActivate(context(token) as never);
    expect(token).toMatchObject({ role: Role.JUDGE, email: 'current', staffPermissions: ['SCORE'], organizationUnitId: 'unit' });
  });

  it('rejects a stale token version, inactive accounts, and unverified accounts', async () => {
    for (const state of [{ tokenVersion: 4 }, { isActive: false }, { verified: false }]) {
      const repository = { findUserById: jest.fn().mockResolvedValue({ verified: true, isActive: true, tokenVersion: 3, ...state }) };
      await expect(new AccountGuard(repository as unknown as AuthRepository).canActivate(context({ sub: 'u', tokenVersion: 3 }) as never)).rejects.toThrow(UnauthorizedException);
    }
  });
});
