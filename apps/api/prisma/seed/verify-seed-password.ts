import {
  assertArgon2idHash,
  DEFAULT_SEED_PASSWORD,
  hashSeedPassword,
} from './password';

const password = process.env.SEED_ADMIN_PASSWORD ?? DEFAULT_SEED_PASSWORD;

async function main(value: string) {
  assertArgon2idHash(await hashSeedPassword(value));
  console.log('Seed password hash format verified.');
}

void main(password).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
