import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash, createHmac } from 'node:crypto';
import { AuthRepository } from '../repositories/auth.repository';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { OtpService } from './otp.service';

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
