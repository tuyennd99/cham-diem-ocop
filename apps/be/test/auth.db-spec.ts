import { OtpPurpose, Prisma, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'node:crypto';
import { OtpService } from '../src/services/otp.service';
import { MailService } from '../src/services/mail.service';
import { databaseObject } from '../src/prisma/sql';
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

type Registration = {
  registrationToken: string; email: string; expiresAt: string; otpExpiresAt: string; resendAvailableAt: string;
};

function post<T = unknown>(baseUrl: string, path: string, body: object) {
  return apiRequest<{ data: T }>(baseUrl, path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

async function register(baseUrl: string, email: string, password = 'ValidPassword1!', fullName = 'HTX A') {
  const result = await post<Registration>(baseUrl, '/auth/register', { email, password, fullName });
  expect(result.status).toBe(200);
  return result.body.data;
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

describe('registration creates an account only after OTP', () => {
  it('keeps registration pending until verification and refuses reuse', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `pending-${randomUUID()}@example.invalid`;
      let code = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      const data = await register(baseUrl, email);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      const pending = await prisma.pendingAuth.findUniqueOrThrow({ where: { tokenHash: tokenHash(data.registrationToken) } });
      expect(pending.tokenHash).not.toBe(data.registrationToken);
      expect(pending.otpHash).not.toBe(code);
      expect(pending.passwordHash).not.toBe('ValidPassword1!');
      expect(new Date(data.expiresAt).getTime() - pending.createdAt.getTime()).toBe(15 * 60_000);
      const status = await post<Registration & { mode: string }>(baseUrl, '/auth/registration-status', { registrationToken: data.registrationToken });
      expect(status.status).toBe(200);
      expect(status.body.data).toEqual({ mode: 'register', email, expiresAt: data.expiresAt, otpExpiresAt: data.otpExpiresAt, resendAvailableAt: data.resendAvailableAt });
      const request = { registrationToken: data.registrationToken, code };
      const wrongCode = code === '000000' ? '111111' : '000000';
      expect((await post(baseUrl, '/auth/verify-otp', { ...request, code: wrongCode })).status).toBe(401);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect((await post(baseUrl, '/auth/verify-otp', request)).status).toBe(200);
      expect(await prisma.user.findUnique({ where: { email } })).toMatchObject({ verified: true, fullName: 'HTX A' });
      expect(await prisma.pendingAuth.findUnique({ where: { tokenHash: tokenHash(data.registrationToken) } })).toBeNull();
      expect((await post(baseUrl, '/auth/verify-otp', request)).status).toBe(401);
      expect((await post(baseUrl, '/auth/registration-status', { registrationToken: data.registrationToken })).status).toBe(401);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
    });
  });

  it('creates no user when SMTP throws and allows a new registration attempt', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `smtp-${randomUUID()}@example.invalid`;
      app.get(MailService).sendOtp = jest.fn().mockRejectedValueOnce(new Error('smtp unavailable')).mockResolvedValue(undefined);
      expect((await post(baseUrl, '/auth/register', { email, password: 'ValidPassword1!', fullName: 'HTX A' })).status).toBe(500);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      await register(baseUrl, email);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });
  });

  it.each(['otp', 'session'] as const)('rejects an expired %s without creating a user', async (expiry) => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `expired-${randomUUID()}@example.invalid`;
      let code = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      const data = await register(baseUrl, email);
      await prisma.pendingAuth.update({ where: { tokenHash: tokenHash(data.registrationToken) }, data: expiry === 'otp' ? { otpExpiresAt: new Date(0) } : { expiresAt: new Date(0) } });
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code })).status).toBe(401);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });
  });

  it('commits wrong attempts and rejects the correct OTP after five wrong attempts', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `attempts-${randomUUID()}@example.invalid`;
      let code = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      const data = await register(baseUrl, email);
      const wrongCode = code === '000000' ? '111111' : '000000';
      for (let attempt = 1; attempt <= 5; attempt++) {
        expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code: wrongCode })).status).toBe(401);
        expect(await prisma.pendingAuth.findUniqueOrThrow({ where: { tokenHash: tokenHash(data.registrationToken) } })).toMatchObject({ attempts: attempt });
        expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      }
      // Bypass the separate IP throttle to exercise the persisted attempt limit on a correct sixth code.
      await expect(app.get(OtpService).verifyRegistration(data.registrationToken, code)).rejects.toThrow('Invalid or expired');
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });
  });

  it('enforces the resend cooldown and invalidates the old code even if SMTP fails', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `resend-${randomUUID()}@example.invalid`;
      let code = '';
      const mail = app.get(MailService);
      mail.sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      const data = await register(baseUrl, email);
      const oldCode = code;
      const request = { registrationToken: data.registrationToken };
      expect((await post(baseUrl, '/auth/resend-otp', request)).status).toBe(429);
      const expiresAt = new Date(Date.now() + 90_000);
      await prisma.pendingAuth.update({ where: { tokenHash: tokenHash(data.registrationToken) }, data: { resendAvailableAt: new Date(0), expiresAt } });
      mail.sendOtp = jest.fn().mockRejectedValue(new Error('smtp unavailable'));
      expect((await post(baseUrl, '/auth/resend-otp', request)).status).toBe(500);
      expect((await post(baseUrl, '/auth/verify-otp', { ...request, code: oldCode })).status).toBe(401);
      const pending = await prisma.pendingAuth.findUniqueOrThrow({ where: { tokenHash: tokenHash(data.registrationToken) } });
      expect(pending.otpExpiresAt).toEqual(expiresAt);
      expect(pending.resendAvailableAt!.getTime()).toBeGreaterThan(Date.now());
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      await prisma.pendingAuth.update({ where: { id: pending.id }, data: { resendAvailableAt: new Date(0) } });
      mail.sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      expect((await post(baseUrl, '/auth/resend-otp', request)).status).toBe(200);
      expect((await post(baseUrl, '/auth/verify-otp', { ...request, code })).status).toBe(200);
    });
  });

  it('preserves separate registration snapshots and rolls back an email conflict', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `sessions-${randomUUID()}@example.invalid`;
      const codes: string[] = [];
      app.get(MailService).sendOtp = jest.fn(async (_email, code) => { codes.push(code); });
      const first = await register(baseUrl, email, 'FirstPassword1!', 'First HTX');
      const second = await register(baseUrl, email, 'SecondPassword2!', 'Second HTX');
      expect(first.registrationToken).not.toBe(second.registrationToken);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: first.registrationToken, code: codes[0] })).status).toBe(200);
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: second.registrationToken, code: codes[1] })).status).toBe(409);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.fullName).toBe('First HTX');
      expect(await bcrypt.compare('FirstPassword1!', user.password)).toBe(true);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
      expect(await prisma.pendingAuth.findUnique({ where: { tokenHash: tokenHash(second.registrationToken) } })).not.toBeNull();
    });
  });

  it('serializes concurrent verification of the same registration', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `concurrent-${randomUUID()}@example.invalid`;
      let code = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      const data = await register(baseUrl, email);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      const responses = await Promise.all([1, 2].map(() => post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code })));
      expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
    });
  });

  it('rolls back user creation when consuming the pending row fails', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `rollback-${randomUUID()}@example.invalid`;
      let code = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      const data = await register(baseUrl, email);
      await prisma.$executeRaw(Prisma.sql`CREATE FUNCTION ${databaseObject('reject_pending_delete')}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test pending delete failure'; END; $$`);
      await prisma.$executeRaw(Prisma.sql`CREATE TRIGGER reject_pending_delete BEFORE DELETE ON ${databaseObject('pending_auth')} FOR EACH ROW EXECUTE FUNCTION ${databaseObject('reject_pending_delete')}()`);
      try {
        expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code })).status).toBe(500);
        expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
        expect(await prisma.pendingAuth.findUnique({ where: { tokenHash: tokenHash(data.registrationToken) } })).not.toBeNull();
      } finally {
        await prisma.$executeRaw(Prisma.sql`DROP TRIGGER reject_pending_delete ON ${databaseObject('pending_auth')}`);
        await prisma.$executeRaw(Prisma.sql`DROP FUNCTION ${databaseObject('reject_pending_delete')}()`);
      }
    });
  });

  it('allows only one of two simultaneous sessions for the same email to create a user', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `parallel-email-${randomUUID()}@example.invalid`;
      const codes: string[] = [];
      app.get(MailService).sendOtp = jest.fn(async (_email, code) => { codes.push(code); });
      const first = await register(baseUrl, email, 'FirstPassword1!', 'First HTX');
      const second = await register(baseUrl, email, 'SecondPassword2!', 'Second HTX');
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      const results = await Promise.all([first, second].map((data, index) => post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code: codes[index] })));
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      expect(await prisma.user.count({ where: { email } })).toBe(1);
      expect(await prisma.pendingAuth.count({ where: { email } })).toBe(1);
    });
  });

  it('rejects missing or unknown registration tokens without creating a user', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      expect((await post(baseUrl, '/auth/registration-status', {})).status).toBe(400);
      expect((await post(baseUrl, '/auth/registration-status', { registrationToken: 'invalid' })).status).toBe(401);
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: 'invalid', code: '123456' })).status).toBe(401);
      expect(await prisma.user.count()).toBe(0);
    });
  });
});

describe('legacy registration recovery', () => {
  it.each([true, false])('only verifies an active legacy user (isActive=%s)', async (isActive) => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const email = `legacy-${randomUUID()}@example.invalid`;
      const user = await createUser(prisma, email);
      await prisma.user.update({ where: { id: user.id }, data: { verified: false, isActive } });
      let code = '';
      app.get(MailService).sendOtp = jest.fn(async (_email, sentCode) => { code = sentCode; });
      expect((await post(baseUrl, '/auth/legacy-registration/resend', { email })).status).toBe(200);
      if (!isActive) {
        code = await app.get(OtpService).issue(email, OtpPurpose.REGISTER, user.id);
      }
      expect((await post(baseUrl, '/auth/legacy-registration/verify', { email, code })).status).toBe(isActive ? 200 : 401);
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ verified: isActive, isActive });
      expect(await prisma.user.count({ where: { email } })).toBe(1);
    });
  });

  it('never creates a missing legacy user and does not expose its existence', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      const email = `missing-${randomUUID()}@example.invalid`;
      expect((await post(baseUrl, '/auth/legacy-registration/resend', { email })).status).toBe(200);
      expect((await post(baseUrl, '/auth/legacy-registration/verify', { email, code: '123456' })).status).toBe(401);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
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

      const data = await register(baseUrl, email, password);
      expect(latestCode).toMatch(/^\d{6}$/);
      expect((await post(baseUrl, '/auth/login', { email, password })).status).toBe(401);
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code: '12345a' })).status).toBe(400);
      const wrongCode = latestCode === '000000' ? '999999' : '000000';
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code: wrongCode })).status).toBe(401);
      await prisma.pendingAuth.update({ where: { tokenHash: tokenHash(data.registrationToken) }, data: { otpExpiresAt: new Date(0) } });
      expect((await post(baseUrl, '/auth/verify-otp', { registrationToken: data.registrationToken, code: latestCode })).status).toBe(401);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });
  });

  it('throttles legacy-registration/resend after 3 requests in the 15-minute window (AUTH-03)', async () => {
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
        apiRequest(baseUrl, '/auth/legacy-registration/resend', {
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
