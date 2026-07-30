import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CODE_PATTERN = /^[A-Za-z0-9._-]+$/;
const unique = (a: number[]) => new Set(a).size === a.length;
const uniqueMsg = { message: 'Giá trị trong mảng phải là duy nhất' };
const idArray = z.array(z.number().int()).refine(unique, uniqueMsg);
const status = z.enum(['ACTIVE', 'INACTIVE']);

const createUserSchema = z.strictObject({
  username: z.string().min(1).max(100).regex(CODE_PATTERN),
  fullName: z.string().min(1).max(255),
  position: z.string().max(255).optional(),
  rank: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  password: z.string().min(6).max(256),
  organizationId: z.number().int(),
  permissionGroupIds: idArray,
});

export class CreateUserDto extends createZodDto(createUserSchema) {}

export class UpdateUserDto extends createZodDto(createUserSchema.partial()) {}

export class LockUserDto extends createZodDto(
  z.strictObject({ reason: z.string().min(1).max(500) }),
) {}

export class ResetPasswordDto extends createZodDto(
  z.strictObject({ password: z.string().min(6).max(256) }),
) {}

const createOrganizationSchema = z.strictObject({
  code: z.string().min(1).max(50).regex(CODE_PATTERN),
  name: z.string().min(1).max(255),
  isAssigningAuthority: z.boolean().optional(),
  isExecutingUnit: z.boolean().optional(),
  status: status.optional(),
});

export class CreateOrganizationDto extends createZodDto(
  createOrganizationSchema,
) {}

export class UpdateOrganizationDto extends createZodDto(
  createOrganizationSchema.partial(),
) {}

const createProgramSchema = z.strictObject({
  code: z.string().min(1).max(50).regex(CODE_PATTERN),
  name: z.string().min(1).max(255),
  description: z.string().max(5_000).optional(),
  status: status.optional(),
});

export class CreateProgramDto extends createZodDto(createProgramSchema) {}

export class UpdateProgramDto extends createZodDto(
  createProgramSchema.partial(),
) {}

const createPermissionGroupSchema = z.strictObject({
  code: z.string().min(1).max(100).regex(CODE_PATTERN),
  name: z.string().min(1).max(255),
  description: z.string().max(5_000).optional(),
  permissionIds: idArray,
});

export class CreatePermissionGroupDto extends createZodDto(
  createPermissionGroupSchema,
) {}

export class UpdatePermissionGroupDto extends createZodDto(
  createPermissionGroupSchema.partial(),
) {}
