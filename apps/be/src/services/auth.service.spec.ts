import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, createHmac } from 'node:crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { OtpService } from './otp.service';
import { GoogleIdentityService } from './google-identity.service';
import { AuthController } from '../controllers/auth.controller';

describe('AuthService', () => {
  const repository = {
    createRegistrant: jest.fn(),
    findUserByEmail: jest.fn(),
    findCredentialsById: jest.fn(),
    changePassword: jest.fn(),
  };
  const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const otpService = { issue: jest.fn(), verify: jest.fn(), issueRegistration: jest.fn(), resendRegistration: jest.fn(), verifyRegistration: jest.fn(), registrationStatus: jest.fn() };
  const mailService = { sendOtp: jest.fn() };
  const service = new AuthService(
    repository as unknown as AuthRepository,
    jwtService as never,
    otpService as unknown as OtpService,
    mailService as unknown as MailService,
    {} as GoogleIdentityService,
  );

  beforeEach(() => { jest.resetAllMocks(); jwtService.signAsync.mockResolvedValue('signed-token'); });

  it('returns the same resend response when no pending account exists', async () => {
    repository.findUserByEmail.mockResolvedValue(null);

    await expect(service.resendLegacyRegistrationOtp(' Missing@Example.com ')).resolves.toEqual({
      message: 'If an unverified account exists, a verification code has been sent',
    });
    expect(repository.findUserByEmail).toHaveBeenCalledWith('missing@example.com');
    expect(otpService.issue).not.toHaveBeenCalled();
    expect(mailService.sendOtp).not.toHaveBeenCalled();
  });

  it('includes the current token version in a login token without exposing it publicly', async () => {
    const previousEnv = { ...process.env };
    Object.assign(process.env, {
      JWT_SECRET: 'isolated-test-jwt-secret-at-least-32-bytes',
      SMTP_HOST: '127.0.0.1', SMTP_USER: 'test', SMTP_PASSWORD: 'test', SMTP_FROM: 'test@example.invalid',
    });
    repository.findUserByEmail.mockResolvedValue({
      id: 'user-1', email: 'person@example.com', password: await bcrypt.hash('ValidPassword1!', 4),
      fullName: 'Person', phone: null, role: Role.REGISTRANT, verified: true, isActive: true, tokenVersion: 2,
      staffPermissions: [], organizationUnitId: null, organizationUnit: null,
    });

    try {
      await expect(service.login('person@example.com', 'ValidPassword1!')).resolves.toMatchObject({
        accessToken: 'signed-token',
        user: { id: 'user-1', email: 'person@example.com' },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { sub: 'user-1', email: 'person@example.com', role: Role.REGISTRANT, tokenVersion: 2 },
        expect.any(Object),
      );
      expect((await service.login('person@example.com', 'ValidPassword1!')).user).not.toHaveProperty('tokenVersion');
    } finally {
      process.env = previousEnv;
    }
  });

  it('sends a registration code only to an active, unverified registrant', async () => {
    repository.findUserByEmail.mockResolvedValue({ id: 'user-1', role: Role.REGISTRANT, verified: false, isActive: true });
    otpService.issue.mockResolvedValue('012345');

    await service.resendLegacyRegistrationOtp('person@example.com');

    expect(otpService.issue).toHaveBeenCalledWith('person@example.com', OtpPurpose.REGISTER, 'user-1');
    expect(mailService.sendOtp).toHaveBeenCalledWith('person@example.com', '012345', 'REGISTER');
  });

  it('does not create a user when registration mail fails', async () => {
    repository.findUserByEmail.mockResolvedValue(null);
    repository.createRegistrant.mockResolvedValue({ id: 'user-1' });
    otpService.issueRegistration.mockResolvedValue({ registrationToken: 'opaque-token', pending: { email: 'person@example.com', expiresAt: new Date(), otpExpiresAt: new Date(), resendAvailableAt: new Date() }, code: '012345' });
    mailService.sendOtp.mockRejectedValueOnce(new Error('smtp unavailable'));
    await expect(service.register({
      email: 'Person@example.com', password: 'Password1!', fullName: 'Person',
    })).rejects.toThrow('Could not send verification email');
    expect(repository.createRegistrant).not.toHaveBeenCalled();
  });

  it('returns only the registration token and public timing fields after SMTP succeeds', async () => {
    const pending = { email: 'person@example.com', expiresAt: new Date(), otpExpiresAt: new Date(), resendAvailableAt: new Date(), passwordHash: 'private', otpHash: 'private' };
    repository.findUserByEmail.mockResolvedValue(null);
    otpService.issueRegistration.mockResolvedValue({ registrationToken: 'opaque-token', pending, code: '012345' });
    const result = await service.register({ email: ' Person@Example.com ', password: 'Password1!', fullName: ' Person ', phone: ' 123 ' });
    expect(result).toEqual({ registrationToken: 'opaque-token', email: pending.email, expiresAt: pending.expiresAt, otpExpiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt });
    const snapshot = otpService.issueRegistration.mock.calls[0][0];
    expect(snapshot).toMatchObject({ email: 'person@example.com', fullName: 'Person', phone: '123' });
    expect(await bcrypt.compare('Password1!', snapshot.passwordHash)).toBe(true);
    expect(repository.createRegistrant).not.toHaveBeenCalled();
  });

  it('rejects registration for an existing account without replacing its password', async () => {
    repository.findUserByEmail.mockResolvedValue({ id: 'existing' });
    await expect(service.register({ email: 'person@example.com', password: 'Password1!', fullName: 'Person' })).rejects.toThrow('Email is already registered');
    expect(otpService.issueRegistration).not.toHaveBeenCalled();
  });

  it('maps a competing email verification to conflict instead of completing registration', async () => {
    otpService.verifyRegistration.mockRejectedValue({ code: 'P2002' });
    await expect(service.verifyOtp('token', '123456')).rejects.toThrow('Email is already registered');
  });

  it('never reports a successful resend when SMTP rejects the rotated code', async () => {
    otpService.resendRegistration.mockResolvedValue({ pending: { email: 'person@example.com' }, code: '654321' });
    mailService.sendOtp.mockRejectedValue(new Error('smtp unavailable'));
    await expect(service.resendRegistrationOtp('token')).rejects.toThrow('Could not send verification email');
  });

  it('changes a password only after checking the current password', async () => {
    const currentHash = await bcrypt.hash('CurrentPassword1!', 4);
    repository.findCredentialsById.mockResolvedValue({ password: currentHash, verified: true, isActive: true });
    repository.changePassword.mockResolvedValue({ count: 1 });

    await expect(service.changePassword('user-1', 'CurrentPassword1!', 'NewPassword2!')).resolves.toEqual({
      message: 'Password changed',
    });
    expect(repository.changePassword).toHaveBeenCalledWith('user-1', currentHash, expect.any(String));
  });

  it('rejects a password change when the current password is wrong', async () => {
    repository.findCredentialsById.mockResolvedValue({
      password: await bcrypt.hash('CurrentPassword1!', 4),
      verified: true,
      isActive: true,
    });

    const attempt = service.changePassword('user-1', 'wrong', 'NewPassword2!');
    await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(attempt).rejects.toThrow('Current password is incorrect');
    expect(repository.changePassword).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    repository.findCredentialsById.mockResolvedValue({
      password: await bcrypt.hash('CurrentPassword1!', 4),
      verified: true,
      isActive: true,
    });

    await expect(service.changePassword('user-1', 'CurrentPassword1!', 'CurrentPassword1!')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.changePassword).not.toHaveBeenCalled();
  });

  it('rejects password login for Google-only accounts using the normal invalid-credentials response', async () => {
    repository.findUserByEmail.mockResolvedValue({ password: null, verified: true, isActive: true });
    const compare = jest.spyOn(bcrypt, 'compare');
    try {
      await expect(service.login('google@example.com', 'anything')).rejects.toThrow('Invalid email or password');
      expect(compare).toHaveBeenCalledWith('anything', expect.stringMatching(/^\$2/));
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    } finally { compare.mockRestore(); }
  });

  it('directs Google-only accounts to forgot password before changing a password', async () => {
    repository.findCredentialsById.mockResolvedValue({ password: null, verified: true, isActive: true });
    await expect(service.changePassword('google-user', 'anything', 'NewPassword2!')).rejects.toThrow('Use forgot password to set an application password');
    expect(repository.changePassword).not.toHaveBeenCalled();
  });

  it('MailService can be instantiated without SMTP environment variables until sendOtp is called', () => {
    const previousEnv = { ...process.env };
    try {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;
      delete process.env.SMTP_FROM;
      expect(() => new MailService()).not.toThrow();
    } finally {
      process.env = previousEnv;
    }
  });

  it('never logs OTP values with the development SMTP placeholder', async () => {
    const previous = { ...process.env };
    Object.assign(process.env, { JWT_SECRET: 'isolated-test-jwt-secret-at-least-32-bytes', SMTP_HOST: 'smtp.example.com', SMTP_USER: 'test', SMTP_PASSWORD: 'test', SMTP_FROM: 'test@example.invalid', NODE_ENV: 'test' });
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    try {
      await new MailService().sendOtp('owner@example.com', '654321', 'GOOGLE_LINK');
      expect(JSON.stringify(log.mock.calls)).not.toContain('654321');
    } finally {
      log.mockRestore(); process.env = previous;
    }
  });
});

describe('pending registration OTP', () => {
  const repository = {
    createPendingRegistration: jest.fn(), findPendingRegistration: jest.fn(), consumePendingRegistration: jest.fn(), replacePendingRegistrationOtp: jest.fn(),
  };
  const otp = new OtpService(repository as unknown as AuthRepository);
  const previousEnv = { ...process.env };
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.JWT_SECRET = 'isolated-test-jwt-secret-at-least-32-bytes';
    Object.assign(process.env, { SMTP_HOST: '127.0.0.1', SMTP_USER: 'test', SMTP_PASSWORD: 'test', SMTP_FROM: 'test@example.invalid' });
    repository.createPendingRegistration.mockImplementation(async (data) => data);
  });
  afterAll(() => { process.env = previousEnv; });

  it('stores only hashes and binds the OTP to its own pending ID', async () => {
    const issued = await otp.issueRegistration({ email: 'new@example.com', fullName: 'HTX A', phone: null, passwordHash: 'bcrypt-hash' });
    expect(issued.registrationToken).toMatch(/^[0-9a-f]{64}$/);
    expect(issued.code).toMatch(/^\d{6}$/);
    expect(issued.pending.tokenHash).toBe(createHash('sha256').update(issued.registrationToken).digest('hex'));
    expect(issued.pending.otpHash).toBe(createHmac('sha256', process.env.JWT_SECRET!).update(`${issued.pending.id}:REGISTER:${issued.code}`).digest('hex'));
    expect(issued.pending.otpHash).not.toBe(issued.code);
    expect(issued.pending.expiresAt.getTime() - issued.pending.createdAt.getTime()).toBe(900_000);
    expect(issued.pending.otpExpiresAt.getTime() - issued.pending.createdAt.getTime()).toBe(300_000);
    expect(issued.pending.resendAvailableAt.getTime() - issued.pending.createdAt.getTime()).toBe(60_000);
  });

  it('refuses expired status without exposing a snapshot', async () => {
    repository.findPendingRegistration.mockResolvedValue({ expiresAt: new Date(0) });
    await expect(otp.registrationStatus('token')).rejects.toThrow('Invalid or expired');
  });

  it('rejects a consumed or invalid code after the repository commits its result', async () => {
    repository.findPendingRegistration.mockResolvedValue({ id: 'pending-id' });
    repository.consumePendingRegistration.mockResolvedValue(false);
    await expect(otp.verifyRegistration('token', '123456')).rejects.toThrow('Invalid or expired');
  });

  it('enforces persisted cooldown independently of SMTP or IP throttles', async () => {
    repository.findPendingRegistration.mockResolvedValue({ id: 'pending-id' });
    repository.replacePendingRegistrationOtp.mockResolvedValue({ status: 'cooldown' });
    await expect(otp.resendRegistration('token')).rejects.toMatchObject({ status: 429 });
  });
});

describe('Google authentication contracts', () => {
  const previous = { ...process.env };
  const repository = { createGoogleChallenge: jest.fn(), findGoogleChallenge: jest.fn(), consumeGoogleChallenge: jest.fn() };
  const identity = { sub: 'google-sub', email: 'owner@example.com', suggestedName: 'Owner', authoritative: false };
  const googleIdentity = { verify: jest.fn() };
  const jwt = { signAsync: jest.fn() };
  const mail = { sendOtp: jest.fn() };
  const service = new AuthService(repository as never, jwt as never, {} as never, mail as never, googleIdentity as never);
  beforeEach(() => {
    jest.resetAllMocks();
    Object.assign(process.env, { GOOGLE_CLIENT_ID: 'test-client', CORS_ORIGINS: 'http://localhost:5173', JWT_SECRET: 'isolated-test-jwt-secret-at-least-32-bytes', SMTP_HOST: '127.0.0.1', SMTP_USER: 'test', SMTP_PASSWORD: 'test', SMTP_FROM: 'test@example.invalid' });
    repository.findGoogleChallenge.mockResolvedValue({ nonceHash: 'stored-nonce-hash', expiresAt: new Date(Date.now() + 60_000) });
    googleIdentity.verify.mockResolvedValue(identity);
    jwt.signAsync.mockResolvedValue('jwt');
    repository.consumeGoogleChallenge.mockImplementation(async (_hash, _identity, _intent, pending) => ({ status: 'pending', pending: { ...pending, kind: 'GOOGLE_LINK', userId: 'existing-user' } }));
  });
  afterAll(() => { process.env = previous; });

  it('returns random challenge secrets while storing only their hashes for five minutes', async () => {
    const result = await service.googleChallenge();
    expect(result.challengeToken).toMatch(/^[0-9a-f]{64}$/);
    expect(result.nonce).toMatch(/^[0-9a-f]{64}$/);
    expect(result.challengeToken).not.toBe(result.nonce);
    const data = repository.createGoogleChallenge.mock.calls[0][0];
    expect(data).toMatchObject({ kind: 'GOOGLE_CHALLENGE', tokenHash: createHash('sha256').update(result.challengeToken).digest('hex'), nonceHash: createHash('sha256').update(result.nonce).digest('hex') });
    expect(JSON.stringify(data)).not.toContain(result.nonce);
    expect(data.expiresAt.getTime() - data.createdAt.getTime()).toBe(300_000);
  });

  it('binds identity verification to the stored nonce and returns link timing only after mail succeeds', async () => {
    const result = await service.google({ challengeToken: 'challenge', credential: 'signed-credential', intent: 'login' });
    expect(googleIdentity.verify).toHaveBeenCalledWith('signed-credential', 'stored-nonce-hash');
    expect(result).toMatchObject({ kind: 'link_otp', email: identity.email, expiresAt: expect.any(Date), otpExpiresAt: expect.any(Date), resendAvailableAt: expect.any(Date) });
    expect(result).not.toHaveProperty('accessToken');
    const data = repository.consumeGoogleChallenge.mock.calls[0][3];
    const [email, code, purpose] = mail.sendOtp.mock.calls[0];
    expect([email, purpose]).toEqual([identity.email, 'GOOGLE_LINK']);
    expect(code).toMatch(/^\d{6}$/);
    expect(data.otpHash).toBe(createHmac('sha256', process.env.JWT_SECRET!).update(`${data.id}:GOOGLE_LINK:${code}`).digest('hex'));
    expect(data.expiresAt.getTime() - data.createdAt.getTime()).toBe(900_000);
    expect(data.otpExpiresAt.getTime() - data.createdAt.getTime()).toBe(300_000);
    expect(data.resendAvailableAt.getTime() - data.createdAt.getTime()).toBe(60_000);
    expect(data.tokenHash).toBe(createHash('sha256').update(result.registrationToken!).digest('hex'));
  });

  it('returns a profile without JWT or mail for a new identity', async () => {
    repository.consumeGoogleChallenge.mockImplementation(async (_hash, _identity, _intent, pending) => ({ status: 'pending', pending: { ...pending, kind: 'GOOGLE_PROFILE' } }));
    await expect(service.google({ challengeToken: 'challenge', credential: 'credential', intent: 'register' })).resolves.toMatchObject({ kind: 'profile', email: identity.email, suggestedName: 'Owner', registrationToken: expect.any(String) });
    expect(jwt.signAsync).not.toHaveBeenCalled(); expect(mail.sendOtp).not.toHaveBeenCalled();
  });

  it('issues the existing account token with tokenVersion and no credential fields', async () => {
    repository.consumeGoogleChallenge.mockResolvedValue({ status: 'session', user: { id: 'user-1', email: identity.email, fullName: 'Original name', phone: null, role: Role.ADMIN, verified: true, tokenVersion: 7, staffPermissions: ['MANAGE', 'VIEW'], organizationUnitId: null, organizationUnit: null } });
    const result = await service.google({ challengeToken: 'challenge', credential: 'credential', intent: 'login' });
    expect(result).toMatchObject({ kind: 'session', accessToken: 'jwt', user: { id: 'user-1', fullName: 'Original name', role: Role.ADMIN } });
    expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'user-1', email: identity.email, role: Role.ADMIN, tokenVersion: 7 }, expect.any(Object));
    if (result.kind !== 'session') throw new Error('Expected Google session');
    expect(result.user).not.toHaveProperty('tokenVersion'); expect(mail.sendOtp).not.toHaveBeenCalled();
  });

  it.each(['used_sub', 'email_exists', 'collision', 'unavailable', 'invalid'])('never issues a token on repository rejection %s', async (status) => {
    repository.consumeGoogleChallenge.mockResolvedValue({ status });
    await expect(service.google({ challengeToken: 'challenge', credential: 'credential', intent: 'register' })).rejects.toBeInstanceOf(Error);
    expect(jwt.signAsync).not.toHaveBeenCalled(); expect(mail.sendOtp).not.toHaveBeenCalled();
  });

  it('rejects expired challenges before verifying a credential', async () => {
    repository.findGoogleChallenge.mockResolvedValue({ nonceHash: 'hash', expiresAt: new Date(0) });
    await expect(service.google({ challengeToken: 'challenge', credential: 'credential', intent: 'login' })).rejects.toMatchObject({ status: 401 });
    expect(googleIdentity.verify).not.toHaveBeenCalled(); expect(repository.consumeGoogleChallenge).not.toHaveBeenCalled();
  });

  it('reports mail failure without returning a pending token or JWT', async () => {
    mail.sendOtp.mockRejectedValue(new Error('SMTP failure'));
    await expect(service.google({ challengeToken: 'challenge', credential: 'credential', intent: 'login' })).rejects.toThrow('Could not send verification email');
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('keeps Google configuration optional but rejects both Google endpoints clearly when absent', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    await expect(service.googleChallenge()).rejects.toThrow('Google sign-in is not configured');
    await expect(service.google({ challengeToken: 'challenge', credential: 'credential', intent: 'login' })).rejects.toThrow('Google sign-in is not configured');
    expect(repository.createGoogleChallenge).not.toHaveBeenCalled(); expect(repository.findGoogleChallenge).not.toHaveBeenCalled();
  });

  it('actively blocks disallowed and missing Origins, and non-JSON challenge requests', () => {
    const controller = new AuthController(service);
    for (const origin of ['', 'https://evil.invalid']) {
      expect(() => controller.googleChallenge(origin, 'application/json')).toThrow('Origin is not allowed');
      expect(() => controller.google({ challengeToken: 'token', credential: 'credential', intent: 'login' }, origin, 'application/json')).toThrow('Origin is not allowed');
    }
    expect(() => controller.googleChallenge('http://localhost:5173', 'text/plain')).toThrow('Google sign-in requires JSON');
    expect(repository.createGoogleChallenge).not.toHaveBeenCalled(); expect(repository.findGoogleChallenge).not.toHaveBeenCalled();
  });
});
