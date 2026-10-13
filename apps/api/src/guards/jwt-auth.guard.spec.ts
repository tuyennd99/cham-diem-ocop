import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

const claims = {
  sub: 1,
  username: 'user',
  organizationId: 10,
  iat: 1_753_315_200,
  exp: 1_753_316_100,
};

describe('JwtAuthGuard', () => {
  const secret = 'test-jwt-secret-at-least-32-characters';
  let request: { headers: { authorization?: string }; user?: unknown };
  let jwtService: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;
  let context: ExecutionContext;

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    request = { headers: { authorization: 'Bearer access-token' } };
    jwtService = { verifyAsync: jest.fn().mockResolvedValue(claims) };
    guard = new JwtAuthGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(false),
      } as unknown as Reflector,
      jwtService as unknown as JwtService,
    );
    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  });

  it('pins algorithm, issuer, audience and secret while verifying', async () => {
    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('access-token', {
      secret,
      algorithms: ['HS256'],
      issuer: 'congan-api',
      audience: 'congan-web',
    });
  });

  it.each([
    { ...claims, sub: '1' },
    { ...claims, organizationId: '10' },
    { ...claims, iat: 'now' },
    { ...claims, exp: undefined },
    { ...claims, username: 1 },
  ])('rejects malformed claims %#', async (payload) => {
    jwtService.verifyAsync.mockResolvedValue(payload);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
    });
  });
});
