import { BadRequestException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PASSWORD_MAX_BYTES, PASSWORD_ROUNDS } from '../constants/auth';

export function assertPasswordLength(password: string): void {
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    throw new BadRequestException(
      `Password must be at most ${PASSWORD_MAX_BYTES} UTF-8 bytes`,
    );
  }
}

export function hashPassword(
  password: string,
  rounds = PASSWORD_ROUNDS,
): Promise<string> {
  return bcrypt.hash(password, rounds);
}
