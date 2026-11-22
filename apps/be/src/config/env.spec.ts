import { env, getRedisUrl, resetEnvCacheForTest } from './env';

const baseEnv = {
  JWT_SECRET: '0123456789abcdef0123456789abcdef',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'user',
  SMTP_PASSWORD: 'secret',
  SMTP_FROM: 'OCOP <noreply@example.com>',
};

describe('env redisUrl', () => {
  afterEach(() => {
    resetEnvCacheForTest();
  });

  it('returns undefined when REDIS_URL is unset or whitespace', () => {
    expect(getRedisUrl({})).toBeUndefined();
    expect(getRedisUrl({ REDIS_URL: '' })).toBeUndefined();
    expect(getRedisUrl({ REDIS_URL: '   ' })).toBeUndefined();
    expect(env({ ...baseEnv }).redisUrl).toBeUndefined();
    expect(env({ ...baseEnv, REDIS_URL: '  ' }).redisUrl).toBeUndefined();
  });

  it('returns trimmed REDIS_URL when configured', () => {
    expect(getRedisUrl({ REDIS_URL: '  redis://127.0.0.1:6379/0  ' })).toBe(
      'redis://127.0.0.1:6379/0',
    );
    expect(
      env({ ...baseEnv, REDIS_URL: ' redis://127.0.0.1:6379/1 ' }).redisUrl,
    ).toBe('redis://127.0.0.1:6379/1');
  });

  it('invalidates cached process.env config when REDIS_URL changes', () => {
    const prev = process.env.REDIS_URL;
    const prevJwt = process.env.JWT_SECRET;
    const prevHost = process.env.SMTP_HOST;
    const prevUser = process.env.SMTP_USER;
    const prevPass = process.env.SMTP_PASSWORD;
    const prevFrom = process.env.SMTP_FROM;

    try {
      process.env.JWT_SECRET = baseEnv.JWT_SECRET;
      process.env.SMTP_HOST = baseEnv.SMTP_HOST;
      process.env.SMTP_USER = baseEnv.SMTP_USER;
      process.env.SMTP_PASSWORD = baseEnv.SMTP_PASSWORD;
      process.env.SMTP_FROM = baseEnv.SMTP_FROM;
      delete process.env.REDIS_URL;
      resetEnvCacheForTest();

      expect(env().redisUrl).toBeUndefined();

      process.env.REDIS_URL = 'redis://127.0.0.1:6379/0';
      expect(env().redisUrl).toBe('redis://127.0.0.1:6379/0');
    } finally {
      if (prev === undefined) delete process.env.REDIS_URL;
      else process.env.REDIS_URL = prev;
      if (prevJwt === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = prevJwt;
      if (prevHost === undefined) delete process.env.SMTP_HOST;
      else process.env.SMTP_HOST = prevHost;
      if (prevUser === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = prevUser;
      if (prevPass === undefined) delete process.env.SMTP_PASSWORD;
      else process.env.SMTP_PASSWORD = prevPass;
      if (prevFrom === undefined) delete process.env.SMTP_FROM;
      else process.env.SMTP_FROM = prevFrom;
      resetEnvCacheForTest();
    }
  });
});
