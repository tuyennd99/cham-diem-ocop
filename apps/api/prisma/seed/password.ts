import {
  argon2,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import type { Argon2Parameters } from 'node:crypto';

const argon2idPrefix = '$argon2id$v=19$m=65536,t=3,p=4$';
const argon2idPattern =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

export const DEFAULT_SEED_PASSWORD = '123456';

export async function hashPassword(password: string) {
  const nonce = randomBytes(16);
  const hash = await derive({
    message: password,
    nonce,
    memory: 65_536,
    parallelism: 4,
    passes: 3,
    tagLength: 32,
  });

  return `${argon2idPrefix}${nonce.toString('base64').replace(/=+$/, '')}$${hash.toString('base64').replace(/=+$/, '')}`;
}

export function assertArgon2idHash(encoded: string) {
  parseArgon2idHash(encoded);
}

export async function verifyPassword(encoded: string, password: string) {
  const { memory, passes, parallelism, nonce, expected } =
    parseArgon2idHash(encoded);
  const actual = await derive({
    message: password,
    nonce,
    memory,
    parallelism,
    passes,
    tagLength: expected.length,
  });

  return timingSafeEqual(actual, expected);
}

export const hashSeedPassword = hashPassword;

function derive(parameters: Argon2Parameters) {
  return new Promise<Buffer>((resolve, reject) => {
    argon2('argon2id', parameters, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

function parseArgon2idHash(encoded: string) {
  const match = encoded.match(argon2idPattern);
  if (!match) {
    throw new Error('Invalid Argon2id encoded hash.');
  }

  const memory = Number(match[1]);
  const passes = Number(match[2]);
  const parallelism = Number(match[3]);
  const nonce = Buffer.from(match[4], 'base64');
  const expected = Buffer.from(match[5], 'base64');
  if (
    memory < 8_192 ||
    memory > 1_048_576 ||
    passes < 1 ||
    passes > 10 ||
    parallelism < 1 ||
    parallelism > 16 ||
    nonce.length < 16 ||
    expected.length < 16 ||
    expected.length > 64
  ) {
    throw new Error('Invalid Argon2id encoded hash.');
  }

  return { memory, passes, parallelism, nonce, expected };
}
