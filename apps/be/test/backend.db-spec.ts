import { Client } from 'pg';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose, Role } from '@prisma/client';
import { existsSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MailService } from '../src/services/mail.service';
import { OtpService } from '../src/services/otp.service';
import { calculateStars } from '../src/utils/scoring';
import { apiRequest, withTestApp } from './support/db-app';

async function tokenFor(baseUrl: string, email: string, password: string) {
  const result = await apiRequest<{ data: { accessToken: string } }>(baseUrl, '/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(result.status).toBe(200);
  return result.body.data.accessToken;
}

async function post<T>(baseUrl: string, path: string, token: string, body: unknown) {
  return apiRequest<T>(baseUrl, path, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function upload(baseUrl: string, productId: string, token: string, name: string, mime: string, bytes: number[]) {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(bytes)], { type: mime }), name);
  const response = await fetch(`${baseUrl}/api/my/products/${productId}/attachments`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return {
    status: response.status,
    body: (await response.json()) as { data: { id: string } },
  };
}

describe('test database safety', () => {
  it.each([
    undefined,
    '',
    'invalid',
    'postgresql://example.invalid/ocop',
    'postgresql://127.0.0.1/ocop?host=example.invalid',
    'postgresql://127.0.0.1/ocop?hostaddr=192.0.2.1',
    'https://localhost/ocop',
  ])('rejects unsafe test database configuration (case %#)', async (value) => {
    const previous = process.env.DATABASE_URL;
    const before = { ...process.env };
    const connect = jest
      .spyOn(Client.prototype, 'connect')
      .mockImplementation(() =>
        Promise.reject(
          new Error('Unsafe test configuration reached connection setup'),
        ),
      );
    try {
      if (value === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = value;
      const run = jest.fn();
      await expect(withTestApp(run)).rejects.toThrow(
        'DATABASE_URL must point to a local database (localhost/127.0.0.1)',
      );
      expect(run).not.toHaveBeenCalled();
      const expected = { ...before };
      if (value === undefined) delete expected.DATABASE_URL;
      else expected.DATABASE_URL = value;
      expect(
        Object.keys(process.env).length === Object.keys(expected).length &&
          Object.entries(expected).every(
            ([key, entry]) => process.env[key] === entry,
          ),
      ).toBe(true);
    } finally {
      connect.mockRestore();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it('restores environment and removes storage when connection setup fails', async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://127.0.0.1/ocop';
    const before = { ...process.env };
    let storage: string;
    const connect = jest
      .spyOn(Client.prototype, 'connect')
      .mockImplementation(() => {
        storage = process.env.STORAGE_PATH!;
        return Promise.reject(new Error('Test connection failure'));
      });
    try {
      await expect(withTestApp(async () => {})).rejects.toThrow(
        'Test connection failure',
      );
      expect(
        Object.keys(process.env).length === Object.keys(before).length &&
          Object.entries(before).every(
            ([key, value]) => process.env[key] === value,
          ),
      ).toBe(true);
      expect(existsSync(storage!)).toBe(false);
    } finally {
      connect.mockRestore();
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});

it('migrates and serves the isolated database with seed data', async () => {
  const before = { ...process.env };
  let schema: string;
  let storage: string;
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    app.get(MailService).sendOtp = jest.fn().mockResolvedValue(undefined);
    schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema')!;
    storage = process.env.STORAGE_PATH!;
    expect(schema).toMatch(/^ocop_test_[a-f0-9]{32}$/);
    expect(process.env.BOOTSTRAP_ADMIN_EMAIL).toBeUndefined();
    expect(process.env.BOOTSTRAP_ADMIN_PASSWORD).toBeUndefined();
    expect(await prisma.productCategory.count()).toBe(26);
    const result = await apiRequest<{ data: unknown[] }>(
      baseUrl,
      '/categories',
    );
    expect(result.status).toBe(200);
    expect(result.body.data).toHaveLength(26);

    const registrant = await prisma.user.create({
      data: {
        email: 'schema-test-registrant@example.invalid',
        password: 'unused-test-hash',
        fullName: 'Schema Test Registrant',
        role: Role.REGISTRANT,
        verified: false,
      },
    });
    const otp = await app.get(OtpService).issue(
      registrant.email,
      OtpPurpose.REGISTER,
      registrant.id,
    );
    expect(
      (await apiRequest(baseUrl, '/auth/legacy-registration/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: registrant.email, code: otp }),
      })).status,
    ).toBe(200);

    const jwt = app.get(JwtService);
    const registrantToken = await jwt.signAsync(
      { sub: registrant.id, email: registrant.email, role: registrant.role, tokenVersion: 0 },
      { algorithm: 'HS256', issuer: 'ocop-api', audience: 'ocop-web', expiresIn: '5m' },
    );
    const category = await prisma.productCategory.findFirstOrThrow({ select: { id: true } });
    const product = await prisma.product.create({
      data: {
        registrantId: registrant.id,
        categoryId: category.id,
        name: 'Schema test draft',
        formData: {},
      },
    });
    expect(
      (await apiRequest(baseUrl, `/my/products/${product.id}`, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${registrantToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Schema test edited draft' }),
      })).status,
    ).toBe(200);
    await expect(prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
      .resolves.toMatchObject({ name: 'Schema test edited draft' });

    const admin = await prisma.user.create({
      data: {
        email: 'schema-test-admin@example.invalid',
        password: 'unused-test-hash',
        fullName: 'Schema Test Admin',
        role: Role.ADMIN,
        staffPermissions: ['MANAGE', 'VIEW'],
        verified: true,
      },
    });
    const adminToken = await jwt.signAsync(
      { sub: admin.id, email: admin.email, role: admin.role, tokenVersion: 0 },
      { algorithm: 'HS256', issuer: 'ocop-api', audience: 'ocop-web', expiresIn: '5m' },
    );
    const dashboard = await apiRequest<{ data: { judges: unknown[] } }>(
      baseUrl,
      '/admin/dashboard',
      { headers: { authorization: `Bearer ${adminToken}` } },
    );
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.data.judges).toEqual([]);
  });
  expect(
    Object.keys(process.env).length === Object.keys(before).length &&
      Object.entries(before).every(
        ([key, value]) => process.env[key] === value,
      ),
  ).toBe(true);
  expect(existsSync(storage!)).toBe(false);
  {
    const connectionUrl = new URL(
      process.env.DATABASE_URL!,
    );
    connectionUrl.searchParams.delete('schema');
    if (connectionUrl.searchParams.get('sslmode') === 'require')
      connectionUrl.searchParams.set('uselibpqcompat', 'true');
    const client = new Client({
      connectionString: connectionUrl.toString(),
    });
    try {
      await client.connect();
      const result = await client.query(
        'SELECT 1 FROM pg_namespace WHERE nspname = $1',
        [schema!],
      );
      expect(result.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  }
});

describe('HTTP production journey', () => {
  it('registers, submits, scores with two judges, and exposes only public image data', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const suffix = randomUUID();
      const password = 'RegistrantPass1!';
      const email = `journey-${suffix}@example.invalid`;
      const sentCodes: string[] = [];
      app.get(MailService).sendOtp = jest.fn(async (_email, code, purpose) => {
        expect(purpose).toBe('REGISTER');
        sentCodes.push(code);
      });
      const registration = await apiRequest<{ data: { registrationToken: string } }>(baseUrl, '/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: 'Journey Registrant',
        }),
      });
      expect(registration.status).toBe(200);
      expect(sentCodes).toHaveLength(1);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
      expect(
        (
          await post(baseUrl, '/auth/verify-otp', '', {
            registrationToken: registration.body.data.registrationToken,
            code: sentCodes[0],
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await post(baseUrl, '/auth/verify-otp', '', {
            registrationToken: registration.body.data.registrationToken,
            code: sentCodes[0],
          })
        ).status,
      ).toBe(401);
      const registrantToken = await tokenFor(baseUrl, email, password);

      const admin = await prisma.user.create({
        data: {
          email: `journey-admin-${suffix}@example.invalid`,
          password: await bcrypt.hash('AdminPassword1!', 4),
          fullName: 'Journey Admin',
          role: Role.ADMIN,
          staffPermissions: ['MANAGE', 'VIEW'],
          verified: true,
        },
      });
      const adminToken = await tokenFor(baseUrl, admin.email, 'AdminPassword1!');
      const judgeUnit = await prisma.organizationUnit.create({
        data: { code: `TEST-JUDGE-${suffix}`, name: 'Test judge unit' },
      });
      const locality = await prisma.locality.create({
        data: {
          code: `TEST-LOCALITY-${suffix}`,
          name: 'Journey locality',
          type: 'COMMUNE',
          provinceName: 'Hà Nội',
        },
      });
      const categories = await apiRequest<{
        data: Array<{
          id: string;
          criteriaSet: { criteria: Array<{ id: string }> };
        }>;
      }>(baseUrl, '/categories');
      const category = categories.body.data.find(({ criteriaSet }) => criteriaSet?.criteria?.length);
      expect(categories.status).toBe(200);
      expect(category).toBeDefined();
      const criteriaIds = category!.criteriaSet.criteria.map(({ id }) => id);

      const created = await post<{ data: { id: string } }>(baseUrl, '/my/products', registrantToken, {
        categoryId: category!.id,
        localityId: locality.id,
        name: 'Journey product',
        description: 'End-to-end test',
        formData: {
          entityName: 'Test Cooperative',
          representativeName: 'Test Representative',
          representativeTitle: 'Director',
          contactAddress: '1 Test Road',
          provinceName: 'Hà Nội',
          phone: '0900000000',
          registrationType: 'FIRST',
          sampleQuantity: 1,
          assessmentYear: 2026,
          declarationAccepted: true,
        },
      });
      expect(created.status).toBe(201);
      const productId = created.body.data.id;
      const image = await upload(
        baseUrl,
        productId,
        registrantToken,
        'product.png',
        'image/png',
        [137, 80, 78, 71, 13, 10, 26, 10],
      );
      const pdf = await upload(
        baseUrl,
        productId,
        registrantToken,
        'evidence.pdf',
        'application/pdf',
        [37, 80, 68, 70, 45, 49],
      );
      expect(image.status).toBe(201);
      expect(pdf.status).toBe(201);
      const imageId = image.body.data.id;
      const pdfId = pdf.body.data.id;
      expect((await post(baseUrl, `/my/products/${productId}/submit`, registrantToken, {})).status).toBe(201);

      const createdJudges = await Promise.all(
        [1, 2, 3].map((n) =>
          post<{ data: { id: string } }>(baseUrl, '/admin/judges', adminToken, {
            email: `journey-judge-${n}-${suffix}@example.invalid`,
            fullName: `Journey Judge ${n}`,
            password: `JudgePassword${n}!`,
            organizationUnitId: judgeUnit.id,
            reason: 'Journey setup',
          }),
        ),
      );
      expect(createdJudges.map(({ status }) => status)).toEqual([201, 201, 201]);
      const [judge1, judge2, unassignedJudge] = createdJudges.map(({ body }) => body.data.id);
      expect(
        (
          await apiRequest(baseUrl, '/admin/assignments', {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${registrantToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ assignments: [] }),
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await post(baseUrl, '/admin/judges', registrantToken, {
            email: `forbidden-${suffix}@example.invalid`,
            fullName: 'No',
            password: 'JudgePassword4!',
          })
        ).status,
      ).toBe(403);
      const assignments = await apiRequest(baseUrl, '/admin/assignments', {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${adminToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          assignments: [judge1, judge2].map((judgeId) => ({
            judgeId,
            categoryId: category!.id,
            criterionIds: criteriaIds,
          })),
        }),
      });
      expect(assignments.status).toBe(200);

      // Authenticate each admin-created judge through the real login route.
      const judgeUsers = await prisma.user.findMany({
        where: { id: { in: [judge1, judge2, unassignedJudge] } },
        orderBy: { email: 'asc' },
      });
      const tokens = await Promise.all(
        judgeUsers.map((judge) =>
          tokenFor(baseUrl, judge.email, `JudgePassword${Number(judge.email.match(/judge-(\d)-/)?.[1])}!`),
        ),
      );
      const [firstToken, secondToken, unassignedToken] = tokens;
      expect(
        (
          await fetch(`${baseUrl}/api/judge/products/${productId}/evaluation`, {
            headers: { authorization: `Bearer ${unassignedToken}` },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(`${baseUrl}/api/judge/products/${productId}/attachments/${pdfId}`, {
            headers: { authorization: `Bearer ${unassignedToken}` },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await apiRequest(baseUrl, `/judge/products/${productId}/evaluation`, {
            headers: { authorization: `Bearer ${registrantToken}` },
          })
        ).status,
      ).toBe(403);

      const evaluation1 = await apiRequest<{
        data: {
          criteria: Array<{
            subCriteria: Array<{
              id: string;
              options: Array<{ id: string; points: number }>;
            }>;
          }>;
        };
      }>(baseUrl, `/judge/products/${productId}/evaluation`, {
        headers: { authorization: `Bearer ${firstToken}` },
      });
      const evaluation2 = await apiRequest<typeof evaluation1.body>(
        baseUrl,
        `/judge/products/${productId}/evaluation`,
        { headers: { authorization: `Bearer ${secondToken}` } },
      );
      expect(evaluation1.status).toBe(200);
      expect(evaluation2.status).toBe(200);
      const scoresFor = (evaluation: typeof evaluation1.body) =>
        evaluation.data.criteria.flatMap(({ subCriteria }) =>
          subCriteria.map(({ id, options }) => {
            const selected = options.reduce((best, option) => (option.points > best.points ? option : best));
            return {
              subCriterionId: id,
              optionId: selected.id,
              points: selected.points,
            };
          }),
        );
      const score1 = scoresFor(evaluation1.body);
      const score2 = scoresFor(evaluation2.body);
      expect(score1.length).toBeGreaterThan(0);
      const payload1 = score1.map(({ points: _points, ...score }) => score);
      const payload2 = score2.map(({ points: _points, ...score }) => score);
      expect(
        (
          await apiRequest(baseUrl, `/judge/products/${productId}/evaluation`, {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${firstToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ scores: payload1 }),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await apiRequest(baseUrl, `/judge/products/${productId}/evaluation/submit`, {
            method: 'POST',
            headers: { authorization: `Bearer ${firstToken}` },
          })
        ).status,
      ).toBe(201);
      expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).status).toBe('SCORING');
      expect(
        (
          await apiRequest(baseUrl, `/judge/products/${productId}/evaluation`, {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${secondToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ scores: payload2 }),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await apiRequest(baseUrl, `/judge/products/${productId}/evaluation/submit`, {
            method: 'POST',
            headers: { authorization: `Bearer ${secondToken}` },
          })
        ).status,
      ).toBe(201);

      const expectedScore =
        (score1.reduce((sum, row) => sum + row.points, 0) + score2.reduce((sum, row) => sum + row.points, 0)) / 2;
      const results = await apiRequest<{
        data: { status: string; finalScore: number; starRating: number };
      }>(baseUrl, `/admin/products/${productId}/results`, {
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(results.status).toBe(200);
      expect(results.body.data).toMatchObject({
        status: 'COMPLETED',
        finalScore: expectedScore,
      });
      expect(results.body.data.starRating).toBe(calculateStars(expectedScore));
      const publicResult = await apiRequest<{
        data: {
          status: string;
          finalScore: number;
          starRating: number;
          attachments: Array<{ id: string }>;
        };
      }>(baseUrl, `/products/${productId}`);
      expect(publicResult.status).toBe(200);
      expect(publicResult.body.data).toMatchObject({
        status: 'COMPLETED',
        finalScore: expectedScore,
        starRating: calculateStars(expectedScore),
      });
      expect(publicResult.body.data).not.toHaveProperty('formData');
      expect(publicResult.body.data).not.toHaveProperty('registrant');
      expect(publicResult.body.data.attachments.map(({ id }) => id)).toEqual([imageId]);
      expect(publicResult.body.data.attachments.map(({ id }) => id)).not.toContain(pdfId);
      expect((await fetch(`${baseUrl}/api/products/${productId}/attachments/${pdfId}`)).status).toBe(404);
      expect((await fetch(`${baseUrl}/api/products/${productId}/attachments/${imageId}`)).status).toBe(200);

      const otherEmail = `other-${suffix}@example.invalid`;
      const otherPassword = 'OtherRegistrant1!';
      await prisma.user.create({
        data: {
          email: otherEmail,
          password: await bcrypt.hash(otherPassword, 4),
          fullName: 'Other Registrant',
          role: Role.REGISTRANT,
          verified: true,
        },
      });
      const otherToken = await tokenFor(baseUrl, otherEmail, otherPassword);
      const draft = await post<{ data: { id: string } }>(baseUrl, '/my/products', registrantToken, {
        categoryId: category!.id,
        name: 'Journey private draft',
        formData: {},
      });
      expect(draft.status).toBe(201);
      const draftId = draft.body.data.id;
      expect(
        (
          await apiRequest(baseUrl, `/my/products/${productId}`, {
            headers: { authorization: `Bearer ${otherToken}` },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await apiRequest(baseUrl, `/my/products/${productId}/attachments/${pdfId}`, {
            headers: { authorization: `Bearer ${otherToken}` },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await apiRequest(baseUrl, `/my/products/${draftId}`, {
            headers: { authorization: `Bearer ${otherToken}` },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await apiRequest(baseUrl, `/my/products/${draftId}`, {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${otherToken}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ name: 'Stolen' }),
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await apiRequest(baseUrl, `/my/products/${draftId}`, {
            method: 'DELETE',
            headers: { authorization: `Bearer ${otherToken}` },
          })
        ).status,
      ).toBe(404);
      await expect(prisma.product.findUniqueOrThrow({ where: { id: draftId } })).resolves.toMatchObject({
        status: 'DRAFT',
        name: 'Journey private draft',
      });
      await prisma.user.update({
        where: { id: unassignedJudge },
        data: { isActive: false },
      });
      expect(
        (
          await apiRequest(baseUrl, '/auth/me', {
            headers: { authorization: `Bearer ${unassignedToken}` },
          })
        ).status,
      ).toBe(401);
    });
  });

  it('rejects an expired password-reset OTP over HTTP without changing the account', async () => {
    await withTestApp(async ({ prisma, baseUrl }) => {
      const suffix = randomUUID();
      const email = `otp-expired-${suffix}@example.invalid`;
      const password = 'OtpPassword1!';
      const user = await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash(password, 4),
          fullName: 'OTP Test',
          role: Role.REGISTRANT,
          verified: true,
        },
      });
      const oldHash = user.password;
      const code = '111111';
      const codeHash = createHmac('sha256', process.env.JWT_SECRET!)
        .update(`${email}:${OtpPurpose.RESET_PASSWORD}:${code}`)
        .digest('hex');
      await prisma.otpCode.create({
        data: {
          email,
          userId: user.id,
          purpose: OtpPurpose.RESET_PASSWORD,
          code: codeHash,
          expiresAt: new Date(Date.now() - 1),
        },
      });
      expect(
        (
          await apiRequest(baseUrl, '/auth/reset-password', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, code, newPassword: 'OtpReplacement2!' }),
          })
        ).status,
      ).toBe(401);
      await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
        password: oldHash,
        tokenVersion: 0,
        verified: true,
      });
    });
  });

  it('locks reset OTP after five HTTP failures and serializes concurrent registration consumes', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const suffix = randomUUID();
      const email = `otp-attempts-${suffix}@example.invalid`;
      const user = await prisma.user.create({
        data: {
          email,
          password: await bcrypt.hash('OtpPassword1!', 4),
          fullName: 'OTP Test',
          role: Role.REGISTRANT,
          verified: true,
        },
      });
      const code = '222222';
      const codeHash = createHmac('sha256', process.env.JWT_SECRET!)
        .update(`${email}:${OtpPurpose.RESET_PASSWORD}:${code}`)
        .digest('hex');
      const replacement = 'OtpReplacement2!';
      const oldHash = user.password;
      await prisma.otpCode.create({
        data: {
          email,
          userId: user.id,
          purpose: OtpPurpose.RESET_PASSWORD,
          code: codeHash,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(
          (
            await apiRequest(baseUrl, '/auth/reset-password', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, code: '333333', newPassword: replacement }),
            })
          ).status,
        ).toBe(401);
      }
      await expect(
        app.get(OtpService).verify(
          email,
          OtpPurpose.RESET_PASSWORD,
          code,
          await bcrypt.hash(replacement, 4),
        ),
      ).rejects.toThrow('Invalid or expired verification code');
      await expect(prisma.user.findUniqueOrThrow({ where: { id: user.id } })).resolves.toMatchObject({
        password: oldHash,
        tokenVersion: 0,
        verified: true,
      });

      const concurrentEmail = `otp-race-${suffix}@example.invalid`;
      const pending = await prisma.user.create({
        data: {
          email: concurrentEmail,
          password: oldHash,
          fullName: 'Concurrent OTP',
          role: Role.REGISTRANT,
          verified: false,
        },
      });
      const concurrentCode = await app.get(OtpService).issue(concurrentEmail, OtpPurpose.REGISTER, pending.id);
      const consume = () =>
        apiRequest(baseUrl, '/auth/legacy-registration/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: concurrentEmail, code: concurrentCode }),
        });
      const outcomes = await Promise.all([consume(), consume()]);
      expect(outcomes.map(({ status }) => status).sort()).toEqual([200, 401]);
      await expect(prisma.user.findUniqueOrThrow({ where: { id: pending.id } })).resolves.toMatchObject({
        verified: true,
      });
    });
  });
});
