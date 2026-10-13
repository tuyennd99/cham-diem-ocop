import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { env } from './env';

const valid = {
  JWT_SECRET: 'j'.repeat(32),
  CSRF_SECRET: 'c'.repeat(32),
};

describe('environment security configuration', () => {
  it.each(['JWT_SECRET', 'CSRF_SECRET'] as const)(
    'fails fast when %s is missing or shorter than 32 bytes',
    (name) => {
      expect(() => env({ ...valid, [name]: undefined })).toThrow(name);
      expect(() => env({ ...valid, [name]: 'x'.repeat(31) })).toThrow(name);
    },
  );

  it('accepts secrets based on UTF-8 byte length', () => {
    const result = env({
      ...valid,
      JWT_SECRET: 'â'.repeat(16),
      CSRF_SECRET: 'đ'.repeat(16),
    });
    expect(typeof result.jwtSecret).toBe('string');
    expect(typeof result.csrfSecret).toBe('string');
  });

  it('uses zero trusted proxy hops by default and rejects invalid values', () => {
    expect(env(valid).trustProxyHops).toBe(0);
    expect(env({ ...valid, TRUST_PROXY_HOPS: '1' }).trustProxyHops).toBe(1);
    expect(() => env({ ...valid, TRUST_PROXY_HOPS: '-1' })).toThrow(
      'TRUST_PROXY_HOPS',
    );
    expect(() => env({ ...valid, TRUST_PROXY_HOPS: '1.5' })).toThrow(
      'TRUST_PROXY_HOPS',
    );
  });

  it('documents production auth and proxy settings', () => {
    const example = readFileSync(
      resolve(process.cwd(), '.env.example'),
      'utf8',
    );

    expect(example).toContain('JWT_SECRET=');
    expect(example).toContain('CSRF_SECRET=');
    expect(example).toContain('TRUST_PROXY_HOPS=1');
  });

  it('pins the supported Node runtime for native Argon2', () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { engines?: { node?: string } };

    expect(packageJson.engines?.node).toBe('>=24.7 <25');
  });
});
