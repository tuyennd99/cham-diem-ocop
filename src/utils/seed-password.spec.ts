import {
  assertArgon2idHash,
  hashSeedPassword,
  verifyPassword,
} from '../../prisma/seed/password';

jest.setTimeout(30_000);

describe('seed password hash', () => {
  it('uses an unpadded, parseable Argon2id encoded form', async () => {
    const encoded = await hashSeedPassword('verification-password');

    expect(
      encoded
        .split('$')
        .slice(-2)
        .every((segment) => !segment.includes('=')),
    ).toBe(true);
    expect(() => assertArgon2idHash(encoded)).not.toThrow();
  });

  it('verifies the matching password and rejects a different password', async () => {
    const encoded = await hashSeedPassword('verification-password');

    await expect(
      verifyPassword(encoded, 'verification-password'),
    ).resolves.toBe(true);
    await expect(verifyPassword(encoded, 'wrong-password')).resolves.toBe(
      false,
    );
  });

  it('does not block the event loop while deriving a password hash', async () => {
    const hash = hashSeedPassword('verification-password').then(() => 'hash');
    const immediate = new Promise<'immediate'>((resolve) =>
      setImmediate(() => resolve('immediate')),
    );

    await expect(Promise.race([hash, immediate])).resolves.toBe('immediate');
    await hash;
  });
});
