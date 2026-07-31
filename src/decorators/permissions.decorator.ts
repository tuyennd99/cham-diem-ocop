import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
/** Yêu cầu TẤT CẢ các code (AND). */
export const Permissions = (...codes: string[]) =>
  SetMetadata(PERMISSIONS_KEY, codes);

export const ANY_PERMISSIONS_KEY = 'any_permissions';
/** Yêu cầu ÍT NHẤT MỘT trong các code (OR). Dùng cho endpoint dùng chung
 *  bởi nhiều luồng (vd lookup của cả read/create/update). */
export const AnyPermissions = (...codes: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, codes);
