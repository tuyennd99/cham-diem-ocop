import { assertArgon2idHash, hashSeedPassword } from './password';

const password = process.env.SEED_ADMIN_PASSWORD;
if (!password) throw new Error('SEED_ADMIN_PASSWORD is required.');

async function main(value: string) {
  assertArgon2idHash(await hashSeedPassword(value));
  console.log('Seed password hash format verified.');
}

void main(password).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
