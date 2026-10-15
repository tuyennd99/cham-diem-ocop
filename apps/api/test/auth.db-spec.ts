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
        const failed = await apiRequest(baseUrl, '/auth/change-password', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: 'incorrect', newPassword: nextPassword }),
        });
        expect(failed.status).toBe(401);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ tokenVersion: 0 });
        expect((await me(baseUrl, token)).status).toBe(200);

        const changed = await apiRequest(baseUrl, '/auth/change-password', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword: nextPassword }),
        });
        expect(changed.status).toBe(200);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ tokenVersion: 1 });
        expect((await me(baseUrl, token)).status).toBe(401);
        expect((await me(baseUrl, await login(baseUrl, email, nextPassword))).status).toBe(200);
      } finally {
        await prisma.user.delete({ where: { id: user.id } });
      }
    });
  });

  it('revokes login tokens after an OTP reset', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      const email = `auth-otp-${randomUUID()}@example.invalid`;
      const user = await createUser(prisma, email);
      const code = '012345';
      try {
        const token = await login(baseUrl, email, currentPassword);
        await prisma.otpCode.create({
          data: {
            email,
            userId: user.id,
            purpose: OtpPurpose.RESET_PASSWORD,
            code: createHmac('sha256', process.env.JWT_SECRET!).update(`${email}:${OtpPurpose.RESET_PASSWORD}:${code}`).digest('hex'),
            expiresAt: new Date(Date.now() + 60_000),
          },
        });
        const reset = await apiRequest(baseUrl, '/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, code, newPassword: nextPassword }),
        });
        expect(reset.status).toBe(200);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({ tokenVersion: 1 });
        expect((await me(baseUrl, token)).status).toBe(401);
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
          body: JSON.stringify({ password: 'AdminSetPassword3!' }),
        });
        expect(reset.status).toBe(200);
        await expect(prisma.user.findUniqueOrThrow({ where: { id: judge.id } })).resolves.toMatchObject({ tokenVersion: 1 });
        expect((await me(baseUrl, judgeToken)).status).toBe(401);
        expect((await me(baseUrl, await login(baseUrl, judge.email, 'AdminSetPassword3!'))).status).toBe(200);
      } finally {
        await prisma.user.deleteMany({ where: { id: { in: [admin.id, judge.id] } } });
      }
    });
  });
});
