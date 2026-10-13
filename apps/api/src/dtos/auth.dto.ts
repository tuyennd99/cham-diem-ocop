import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class LoginDto extends createZodDto(
  z.strictObject({
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(256),
  }),
) {}

export class ChangePasswordDto extends createZodDto(
  z.strictObject({
    currentPassword: z.string().min(1).max(256),
    newPassword: z.string().min(6).max(256),
  }),
) {}
