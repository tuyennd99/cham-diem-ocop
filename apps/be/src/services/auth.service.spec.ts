import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { OtpPurpose, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
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
  const otpService = { issue: jest.fn(), verify: jest.fn() };
  const mailService = { sendOtp: jest.fn() };
  const service = new AuthService(
    repository as unknown as AuthRepository,
    jwtService as never,
    otpService as unknown as OtpService,
    mailService as unknown as MailService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns the same resend response when no pending account exists', async () => {
    repository.findUserByEmail.mockResolvedValue(null);

    await expect(service.resendRegistrationOtp(' Missing@Example.com ')).resolves.toEqual({
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

    await service.resendRegistrationOtp('person@example.com');

    expect(otpService.issue).toHaveBeenCalledWith('person@example.com', OtpPurpose.REGISTER, 'user-1');
    expect(mailService.sendOtp).toHaveBeenCalledWith('person@example.com', '012345', 'REGISTER');
  });

  it('leaves a pending registration recoverable after mail fails and sends a fresh code on resend', async () => {
    repository.createRegistrant.mockResolvedValue({ id: 'user-1' });
    otpService.issue.mockResolvedValueOnce('012345').mockResolvedValueOnce('678901');
    mailService.sendOtp.mockRejectedValueOnce(new Error('smtp unavailable')).mockResolvedValueOnce(undefined);

    await expect(service.register({
      email: 'Person@example.com', password: 'Password1!', fullName: 'Person',
    })).rejects.toThrow('Could not send verification email');
    expect(repository.createRegistrant).toHaveBeenCalledWith(expect.objectContaining({
      email: 'person@example.com', fullName: 'Person',
    }));

    repository.findUserByEmail.mockResolvedValue({ id: 'user-1', role: Role.REGISTRANT, verified: false, isActive: true });
    await expect(service.resendRegistrationOtp('person@example.com')).resolves.toMatchObject({ message: expect.any(String) });
    expect(otpService.issue).toHaveBeenNthCalledWith(2, 'person@example.com', OtpPurpose.REGISTER, 'user-1');
    expect(mailService.sendOtp).toHaveBeenNthCalledWith(2, 'person@example.com', '678901', 'REGISTER');
    expect(mailService.sendOtp.mock.calls[1][1]).not.toBe(mailService.sendOtp.mock.calls[0][1]);
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
