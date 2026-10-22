import { SetMetadata } from '@nestjs/common';
import type { StaffPermission } from '@prisma/client';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: StaffPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
