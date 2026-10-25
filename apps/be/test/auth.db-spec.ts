import { OtpPurpose, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHmac, randomUUID } from 'node:crypto';
import { MailService } from '../src/services/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { apiRequest, withTestApp } from './support/db-app';

const currentPassword = 'CurrentPassword1!';
const nextPassword = 'NewPassword2!';

async function createUser(prisma: PrismaService, email: string, role: Role = Role.REGISTRANT) {
  return prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash(currentPassword, 4),
      fullName: 'Auth test user',
      role,
      staffPermissions: role === Role.ADMIN ? ['MANAGE', 'VIEW'] : role === Role.JUDGE ? ['SCORE'] : [],
      verified: true,
    },
  });
}

async function login(baseUrl: string, email: string, password: string) {
  const result = await apiRequest<{ data: { accessToken: string } }>(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(result.status).toBe(200);
  return result.body.data.accessToken;
}

async function me(baseUrl: string, token: string) {
  return apiRequest(baseUrl, '/auth/me', { headers: { Authorization: `Bearer ${token}` } });
}

describe('registration recovery after email delivery failure', () => {
  it('keeps the pending account password unchanged and verifies it with a fresh resend code', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `auth-register-${randomUUID()}@example.invalid`;
      const password = 'FirstPassword1!';
      const deliveredCodes: string[] = [];
      const mail = app.get(MailService);
      mail.sendOtp = jest.fn(async (_email, code, purpose) => {
        expect(purpose).toBe('REGISTER');
        deliveredCodes.push(code);
        if (deliveredCodes.length === 1) throw new Error('smtp unavailable');
      });

      const register = (candidatePassword: string) => apiRequest(baseUrl, '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: candidatePassword, fullName: 'Pending registrant' }),
      });
      try {
        expect((await register(password)).status).toBe(500);
        const pending = await prisma.user.findUniqueOrThrow({ where: { email } });
        expect(pending.verified).toBe(false);
        expect(await bcrypt.compare(password, pending.password)).toBe(true);

        expect((await register('DifferentPassword2!')).status).toBe(409);
        const afterRetry = await prisma.user.findUniqueOrThrow({ where: { email } });
        expect(afterRetry.password).toBe(pending.password);
        expect(await bcrypt.compare(password, afterRetry.password)).toBe(true);

        expect((await apiRequest(baseUrl, '/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        })).status).toBe(200);
        expect(deliveredCodes).toHaveLength(2);

        const verified = await apiRequest(baseUrl, '/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: deliveredCodes[1] }),
        });
        expect(verified.status).toBe(200);
        await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject({ verified: true });
      } finally {
        await prisma.user.deleteMany({ where: { email } });
      }
    });
  });
});

describe('password changes revoke all earlier access tokens', () => {
  it('revokes login tokens after a current-password change and leaves version alone on a wrong password', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `auth-change-${randomUUID()}@example.invalid`;
      const user = await createUser(prisma, email);
      try {
        const token = await login(baseUrl, email, currentPassword);
        const legacyToken = await app.get(JwtService).signAsync(
          { sub: user.id, email, role: user.role },
          { secret: process.env.JWT_SECRET, algorithm: 'HS256', issuer: 'ocop-api', audience: 'ocop-web' },
        );
        expect((await me(baseUrl, legacyToken)).status).toBe(401);
        const failed = await apiRequest<{ message: string }>(baseUrl, '/auth/change-password', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'incorrect', newPassword: nextPassword }),
        });
        expect(failed.status).toBe(401);
        expect(failed.body.message).toContain('Current password is incorrect');
        await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ tokenVersion: 0 });
        expect((await me(baseUrl, token)).status).toBe(200);

        const changed = await apiRequest(baseUrl, '/auth/change-password', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword: nextPassword }),
        });
        expect(changed.status).toBe(201);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ tokenVersion: 1 });
        expect((await me(baseUrl, token)).status).toBe(401);
        expect((await me(baseUrl, await login(baseUrl, email, nextPassword))).status).toBe(200);
      } finally {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  it('revokes login tokens after an OTP reset (AUTH-07)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `auth-otp-${randomUUID()}@example.invalid`;
      const user = await createUser(prisma, email);
      let deliveredResetCode = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, code, purpose) => {
        if (purpose === 'RESET_PASSWORD') deliveredResetCode = code;
      });
      try {
        const token = await login(baseUrl, email, currentPassword);
        const forgot = await apiRequest(baseUrl, '/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        expect(forgot.status).toBe(200);
        expect(deliveredResetCode).toMatch(/^\d{6}$/);

        const reset = await apiRequest(baseUrl, '/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code: deliveredResetCode, newPassword: nextPassword }),
        });
        expect(reset.status).toBe(200);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ tokenVersion: 1 });
        expect((await me(baseUrl, token)).status).toBe(401);
        const oldPasswordLogin = await apiRequest(baseUrl, '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: currentPassword }),
        });
        expect(oldPasswordLogin.status).toBe(401);
        expect((await me(baseUrl, await login(baseUrl, email, nextPassword))).status).toBe(200);
      } finally {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  it('revokes a judge token after an administrator resets the judge password', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      const suffix = randomUUID();
      const admin = await createUser(prisma, `auth-admin-${suffix}@example.invalid`, Role.ADMIN);
      const judge = await createUser(prisma, `auth-judge-${suffix}@example.invalid`, Role.JUDGE);
      try {
        const adminToken = await login(baseUrl, admin.email, currentPassword);
        const judgeToken = await login(baseUrl, judge.email, currentPassword);
        const reset = await apiRequest(baseUrl, `/admin/judges/${judge.id}/reset-password`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'AdminSetPassword3!', reason: 'Account recovery' }),
        });
        expect(reset.status).toBe(201);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: judge.id } })).resolves.toMatchObject({ tokenVersion: 1 });
        expect((await me(baseUrl, judgeToken)).status).toBe(401);
        expect((await me(baseUrl, await login(baseUrl, judge.email, 'AdminSetPassword3!'))).status).toBe(200);
      } finally {
        await prisma.user.deleteMany({ where: { id: { in: [admin.id, judge.id] } } });
      }
    });
  });
});

describe('OCOP AUTH-01..04 scenarios (unverified login, OTP format/expiry, resend rate limit, and 72-byte UTF-8 boundary)', () => {
  it('blocks login before OTP verification and validates OTP format, mismatch, and expiry (AUTH-01, AUTH-02)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `auth-01-02-${randomUUID()}@ocop.test`;
      const password = 'ValidPassword@2026';
      let latestCode = '';
      app.get(MailService).sendOtp = jest.fn(async (_to, code) => {
        latestCode = code;
      });

      const reg = await apiRequest(baseUrl, '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName: 'Chủ thể AUTH-01' }),
      });
      expect(reg.status).toBe(200);
      expect(latestCode).toMatch(/^\d{6}$/);

      // AUTH-01: Login before verifying OTP fails with 401
      const unverifiedLogin = await apiRequest(baseUrl, '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(unverifiedLogin.status).toBe(401);

      // AUTH-02: Invalid OTP format ('12345a') returns 400
      const malformedOtp = await apiRequest(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: '12345a' }),
      });
      expect(malformedOtp.status).toBe(400);

      // AUTH-02: Wrong 6-digit OTP returns 401
      const wrongCode = latestCode === '000000' ? '999999' : '000000';
      const wrongOtp = await apiRequest(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: wrongCode }),
      });
      expect(wrongOtp.status).toBe(401);

      // AUTH-02: Expired OTP (> 5 minutes) returns 401
      const expiredCode = '112233';
      await prisma.otpCode.deleteMany({ where: { email } });
      await prisma.otpCode.create({
        data: {
          email,
          purpose: OtpPurpose.REGISTER,
          code: createHmac('sha256', process.env.JWT_SECRET!)
            .update(`${email}:${OtpPurpose.REGISTER}:${expiredCode}`)
            .digest('hex'),
          expiresAt: new Date(Date.now() - 6 * 60_000),
        },
      });
      const expiredOtp = await apiRequest(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: expiredCode }),
      });
      expect(expiredOtp.status).toBe(401);
      await expect(prisma.user.findUniqueOrThrow({ where: { email } })).resolves.toMatchObject({
        verified: false,
      });
    });
  });

  it('throttles resend-otp after 3 requests in the 15-minute window (AUTH-03)', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      const email = `auth-03-${randomUUID()}@ocop.test`;
      await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(currentPassword, 4),
          fullName: 'Pending user AUTH-03',
          role: Role.REGISTRANT,
          verified: false,
        },
      });

      const resend = () =>
        apiRequest(baseUrl, '/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

      expect((await resend()).status).toBe(200);
      expect((await resend()).status).toBe(200);
      expect((await resend()).status).toBe(200);
      expect((await resend()).status).toBe(429);
    });
  });

  it('accepts 72-byte UTF-8 password ("Đ".repeat(36)) and rejects 74-byte UTF-8 password ("Đ".repeat(37)) on register and change-password (AUTH-04)', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      const valid72Bytes = 'Đ'.repeat(36);
      const invalid74Bytes = 'Đ'.repeat(37);
      expect(Buffer.byteLength(valid72Bytes, 'utf8')).toBe(72);
      expect(Buffer.byteLength(invalid74Bytes, 'utf8')).toBe(74);

      const email74 = `auth-04-74-${randomUUID()}@ocop.test`;
      const reg74 = await apiRequest(baseUrl, '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email74,
          password: invalid74Bytes,
          fullName: 'Over 72 UTF-8 bytes',
        }),
      });
      expect(reg74.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { email: email74 } })).toBeNull();

      const email72 = `auth-04-72-${randomUUID()}@ocop.test`;
      const reg72 = await apiRequest(baseUrl, '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email72,
          password: valid72Bytes,
          fullName: 'Exact 72 UTF-8 bytes',
        }),
      });
      expect(reg72.status).toBe(200);

      // Also verify change-password enforces the exact 72-byte UTF-8 boundary
      const changeUser = await createUser(prisma, `auth-04-change-${randomUUID()}@ocop.test`);
      const token = await login(baseUrl, changeUser.email, currentPassword);

      const change74 = await apiRequest(baseUrl, '/auth/change-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: invalid74Bytes }),
      });
      expect(change74.status).toBe(400);

      const change72 = await apiRequest(baseUrl, '/auth/change-password', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword: valid72Bytes }),
      });
      expect(change72.status).toBe(201);
      expect((await me(baseUrl, await login(baseUrl, changeUser.email, valid72Bytes))).status).toBe(200);
    });
  });
});
