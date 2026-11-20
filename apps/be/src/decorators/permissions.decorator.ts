import { SetMetadata } from '@nestjs/common';
import type { StaffPermission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSIONS_ANY_KEY = 'permissionsAny';
export const Permissions = (...permissions: StaffPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const PermissionsAny = (...permissions: StaffPermission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
