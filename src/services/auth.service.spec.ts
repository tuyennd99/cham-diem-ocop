import { JwtService } from '@nestjs/jwt';
import { HttpException } from '@nestjs/common';
import { hashPassword, verifyPassword } from '../../prisma/seed/password';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthService } from './auth.service';

jest.mock('../../prisma/seed/password', () => ({
  hashPassword: jest.fn().mockResolvedValue('new-password-hash'),
  verifyPassword: jest.fn(),
}));

const now = new Date('2026-07-24T00:00:00.000Z');
const testSecret = 'test-secret-at-least-32-characters';
const originalJwtSecret = process.env.JWT_SECRET;
const originalCsrfSecret = process.env.CSRF_SECRET;
const meta = {
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
  requestId: 'request-1',
};
const user = {
  id: 1,
  username: 'user',
  fullName: 'Test User',
  passwordHash: 'password-hash',
  organizationId: 10,
  organization: { id: 10, code: 'UNIT', name: 'Test Unit' },
  status: 'ACTIVE' as const,
  lockedUntil: null,
  failedLoginCount: 0,
  failedLoginWindowStartedAt: null,
};

describe('AuthService', () => {
  let service: AuthService;
  let repo: Record<string, jest.Mock>;
  let jwtService: { signAsync: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    process.env.JWT_SECRET = testSecret;
    process.env.CSRF_SECRET = testSecret;
    repo = {
      findUserByUsername: jest.fn(),
      findUserById: jest.fn(),
      recordUnknownLoginFailure: jest.fn(),
      registerFailedLogin: jest.fn(),
      unlockAutomatically: jest.fn(),
      completeLogin: jest.fn(),
      findSessionByHash: jest.fn(),
      rotateSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      changePassword: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    service = new AuthService(
      repo as unknown as AuthRepository,
      jwtService as unknown as JwtService,
    );
    jest.mocked(verifyPassword).mockResolvedValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
    if (originalCsrfSecret === undefined) delete process.env.CSRF_SECRET;
    else process.env.CSRF_SECRET = originalCsrfSecret;
  });

  it('locks the fifth failed login for five minutes', async () => {
    repo.findUserByUsername.mockResolvedValue({
      ...user,
      failedLoginCount: 4,
      failedLoginWindowStartedAt: new Date(now.getTime() - 30_000),
    });
    repo.registerFailedLogin.mockResolvedValue({
      locked: true,
      lockedUntil: new Date(now.getTime() + 5 * 60_000),
    });

    await expect(service.login('user', 'wrong', meta)).rejects.toMatchObject({
      status: 423,
    });
    expect(repo.registerFailedLogin).toHaveBeenCalledWith(user.id, now, meta);
    expect(repo.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('returns unauthorized when a failed login does not lock the account', async () => {
    repo.findUserByUsername.mockResolvedValue({
      ...user,
      failedLoginCount: 4,
      failedLoginWindowStartedAt: new Date(now.getTime() - 60_001),
    });
    repo.registerFailedLogin.mockResolvedValue({
      locked: false,
      lockedUntil: null,
    });

    await expect(service.login('user', 'wrong', meta)).rejects.toMatchObject({
      status: 401,
    });
    expect(repo.registerFailedLogin).toHaveBeenCalledWith(user.id, now, meta);
  });

  it('automatically unlocks after five minutes and continues login', async () => {
    const expiredLock = new Date(now.getTime() - 1);
    repo.findUserByUsername.mockResolvedValue({
      ...user,
      status: 'LOCKED',
      lockedUntil: expiredLock,
    });
    repo.unlockAutomatically.mockResolvedValue(true);
    repo.completeLogin.mockResolvedValue(true);
    jest.mocked(verifyPassword).mockResolvedValue(true);

    const result = await service.login('user', 'correct', meta);

    expect(repo.unlockAutomatically).toHaveBeenCalledWith(
      user.id,
      expiredLock,
      now,
      meta,
    );
    expect(repo.completeLogin).toHaveBeenCalledWith(
      user.id,
      user.passwordHash,
      expect.any(String),
      new Date(now.getTime() + 30 * 24 * 60 * 60_000),
      now,
      meta,
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      expect.not.objectContaining({ permissions: expect.anything() }),
      expect.any(Object),
    );
    expect(result.user).toEqual(
      expect.not.objectContaining({ permissions: expect.anything() }),
    );
  });

  it('does not automatically unlock a manually locked account', async () => {
    repo.findUserByUsername.mockResolvedValue({
      ...user,
      status: 'LOCKED',
      lockedUntil: null,
    });

    await expect(service.login('user', 'correct', meta)).rejects.toMatchObject({
      status: 423,
    });
    expect(repo.unlockAutomatically).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('rejects login when the serialized success transition loses a race', async () => {
    repo.findUserByUsername.mockResolvedValue({ ...user });
    repo.completeLogin.mockResolvedValue(false);
    jest.mocked(verifyPassword).mockResolvedValue(true);

    await expect(service.login('user', 'correct', meta)).rejects.toMatchObject({
      status: 401,
    });
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rotates a refresh session without extending its absolute expiry', async () => {
    const expiresAt = new Date(now.getTime() + 60_000);
    const csrfToken = service.createCsrfToken();
    repo.findSessionByHash.mockResolvedValue({
      id: 7,
      user: { ...user },
      expiresAt,
      revokedAt: null,
    });
    repo.rotateSession.mockResolvedValue(true);

    await service.refresh('raw-token', csrfToken, meta);

    expect(repo.rotateSession).toHaveBeenCalledWith(
      7,
      user.id,
      expect.any(String),
      expiresAt,
      now,
      meta,
    );
  });

  it('rejects refresh reuse and revokes all sessions', async () => {
    const csrfToken = service.createCsrfToken();
    repo.findSessionByHash.mockResolvedValue({
      id: 7,
      user: { ...user },
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: new Date(now.getTime() - 1),
    });

    await expect(
      service.refresh('reused-token', csrfToken, meta),
    ).rejects.toMatchObject({ status: 401 });
    expect(repo.revokeAllSessions).toHaveBeenCalledWith(
      user.id,
      now,
      'REFRESH_TOKEN_REUSE',
      meta,
    );
  });

  it('rejects a concurrent refresh rotation loser as reuse', async () => {
    const csrfToken = service.createCsrfToken();
    repo.findSessionByHash.mockResolvedValue({
      id: 7,
      user: { ...user },
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
    });
    repo.rotateSession.mockResolvedValue(false);

    await expect(
      service.refresh('raw-token', csrfToken, meta),
    ).rejects.toMatchObject({ status: 401 });
    expect(repo.revokeAllSessions).toHaveBeenCalledWith(
      user.id,
      now,
      'REFRESH_TOKEN_REUSE',
      meta,
    );
  });

  it('rejects expired refresh sessions', async () => {
    const csrfToken = service.createCsrfToken();
    repo.findSessionByHash.mockResolvedValue({
      id: 7,
      user: { ...user },
      expiresAt: new Date(now.getTime() - 1),
      revokedAt: null,
    });

    await expect(
      service.refresh('expired-token', csrfToken, meta),
    ).rejects.toMatchObject({ status: 401 });
    expect(repo.rotateSession).not.toHaveBeenCalled();
  });

  it('validates signed double-submit CSRF tokens', () => {
    const token = service.createCsrfToken();

    expect(() => service.assertCsrfToken(token)).not.toThrow();
    expect(() => service.assertCsrfToken(`${token}x`)).toThrow(HttpException);
    expect(() => service.assertCsrfToken('unsigned')).toThrow(HttpException);
  });

  it('does not fall back when the CSRF secret is missing', () => {
    delete process.env.CSRF_SECRET;
    service = new AuthService(
      repo as unknown as AuthRepository,
      jwtService as unknown as JwtService,
    );

    expect(() => service.createCsrfToken()).toThrow('CSRF_SECRET');
  });

  it('performs a dummy password verification for an unknown username', async () => {
    repo.findUserByUsername.mockResolvedValue(null);

    await expect(
      service.login('missing', 'candidate-password', meta),
    ).rejects.toMatchObject({ status: 401 });
    expect(verifyPassword).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'candidate-password',
    );
  });

  it('revokes only the matching refresh session on logout', async () => {
    const csrfToken = service.createCsrfToken();
    repo.findSessionByHash.mockResolvedValue({
      id: 7,
      user: { ...user },
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: null,
    });

    await service.logout('raw-token', csrfToken, meta);

    expect(repo.revokeSession).toHaveBeenCalledWith(
      7,
      user.id,
      now,
      'LOGOUT',
      meta,
    );
    expect(repo.revokeAllSessions).not.toHaveBeenCalled();
  });

  it('changes the password and revokes sessions through one repository transaction', async () => {
    repo.findUserById.mockResolvedValue({ ...user });
    jest.mocked(verifyPassword).mockResolvedValue(true);

    await service.changePassword(
      user.id,
      'current-password',
      'new-password-value',
      meta,
    );

    expect(hashPassword).toHaveBeenCalledWith('new-password-value');
    expect(repo.changePassword).toHaveBeenCalledWith(
      user.id,
      user.passwordHash,
      'new-password-hash',
      now,
      meta,
    );
  });
});
