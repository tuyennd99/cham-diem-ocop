import { ForbiddenException } from '@nestjs/common';

type Principal = { isAdmin?: boolean; permissions: string[] };

/** Admin, hoặc có đúng permission code. */
export function can(principal: Principal, code: string): boolean {
  return Boolean(principal.isAdmin) || principal.permissions.includes(code);
}

/** Admin, hoặc có ít nhất một trong các code. */
export function canAny(principal: Principal, ...codes: string[]): boolean {
  return Boolean(principal.isAdmin) || codes.some((c) => principal.permissions.includes(c));
}

/** Ném ForbiddenException nếu không có quyền. */
export function assertPermission(principal: Principal, code: string): void {
  if (!can(principal, code)) {
    throw new ForbiddenException(`${code} is required`);
  }
}

// self-check: `ts-node src/utils/principal.ts`
if (require.main === module) {
  const admin = { isAdmin: true, permissions: [] };
  const user = { permissions: ['tasks.read'] };
  console.assert(can(admin, 'anything'), 'admin bypass');
  console.assert(can(user, 'tasks.read'), 'exact code');
  console.assert(!can(user, 'tasks.write'), 'missing code');
  console.assert(canAny(user, 'x', 'tasks.read'), 'any hit');
  console.assert(!canAny(user, 'x', 'y'), 'any miss');
  let threw = false;
  try { assertPermission(user, 'tasks.write'); } catch { threw = true; }
  console.assert(threw, 'assert throws');
  console.log('principal util OK');
}
