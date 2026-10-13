import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard', () => {
  const guard = Object.create(UserThrottlerGuard.prototype) as {
    getTracker(request: Record<string, unknown>): Promise<string>;
  };

  it('uses the authenticated user id and falls back to the client IP', async () => {
    await expect(
      guard.getTracker({ user: { sub: 42 }, ip: '127.0.0.1' }),
    ).resolves.toBe('user:42');
    await expect(guard.getTracker({ ip: '127.0.0.1' })).resolves.toBe(
      'ip:127.0.0.1',
    );
  });
});
