import 'dotenv/config';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { configureApp } from '../../src/config/app';
import { MailService } from '../../src/services/mail.service';
import { PrismaService } from '../../src/prisma/prisma.service';

let sharedSchema: string | undefined;
let sharedClientUrl: string | undefined;

async function clearExistingData(client: Client) {
  await client.query('DELETE FROM "scores"');
  await client.query('DELETE FROM "evaluations"');
  await client.query('DELETE FROM "judge_assignments"');
  await client.query('DELETE FROM "attachments"');
  await client.query('DELETE FROM "products"');
  await client.query('DELETE FROM "localities"');
  await client.query('DELETE FROM "otp_codes"');
  await client.query('DELETE FROM "audit_logs"');
  await client.query('DELETE FROM "users"');
  await client.query('DELETE FROM "organization_units"');
}

async function copySeedData(client: Client, schema: string) {
  try {
    const counts = await client.query(
      'SELECT (SELECT count(*) FROM public."product_categories")::int AS categories, (SELECT count(*) FROM public."criteria_sets")::int AS sets, (SELECT count(*) FROM public."criteria")::int AS criteria, (SELECT count(*) FROM public."sub_criteria")::int AS sub_criteria, (SELECT count(*) FROM public."score_options")::int AS options',
    );
    if (
      counts.rows[0].categories !== 26 ||
      counts.rows[0].sets !== 26 ||
      !counts.rows[0].criteria ||
      !counts.rows[0].sub_criteria ||
      !counts.rows[0].options
    ) {
      return false;
    }
    await client.query(`SET search_path TO "${schema}"`);
    await client.query('BEGIN');
    await client.query('INSERT INTO "product_groups" SELECT * FROM public."product_groups" ON CONFLICT DO NOTHING');
    for (const table of [
      'product_categories',
      'criteria_sets',
      'criteria',
      'sub_criteria',
      'score_options',
    ]) {
      await client.query(`INSERT INTO "${table}" SELECT * FROM public."${table}"`);
    }
    await client.query('COMMIT');
    return true;
  } catch {
    await client.query('ROLLBACK').catch(() => undefined);
    return false;
  }
}

afterAll(async () => {
  if (!sharedSchema || !sharedClientUrl) return;
  const client = new Client({ connectionString: sharedClientUrl });
  try {
    await client.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${sharedSchema}" CASCADE`);
  } finally {
    await client.end();
    sharedSchema = undefined;
    sharedClientUrl = undefined;
  }
});

export async function withTestApp(
  run: (context: {
    app: INestApplication;
    prisma: PrismaService;
    baseUrl: string;
  }) => Promise<void>,
): Promise<void> {
  const message = 'DATABASE_URL must point to a local database (localhost/127.0.0.1)';
  const rawDbUrl = process.env.DATABASE_URL;
  let testUrl: URL;
  try {
    testUrl = new URL(rawDbUrl ?? '');
  } catch {
    throw new Error(message);
  }
  if (
    !['postgresql:', 'postgres:'].includes(testUrl.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(testUrl.hostname) ||
    testUrl.searchParams.has('host') ||
    testUrl.searchParams.has('hostaddr')
  ) {
    throw new Error(message);
  }

  if (testUrl.searchParams.get('sslmode') === 'require' && !testUrl.searchParams.has('uselibpqcompat')) {
    testUrl.searchParams.set('uselibpqcompat', 'true');
  }
  const schema = sharedSchema ?? `ocop_test_${randomUUID().replaceAll('-', '')}`;
  const clientUrl = new URL(testUrl.toString());
  clientUrl.searchParams.delete('schema');
  testUrl.searchParams.set('schema', schema);
  const storage = mkdtempSync(resolve(tmpdir(), 'ocop-test-'));
  const overrides: NodeJS.ProcessEnv = {
    DATABASE_URL: testUrl.toString(),
    JWT_SECRET: 'isolated-test-jwt-secret-at-least-32-bytes',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    SMTP_FROM: 'test@example.invalid',
    STORAGE_PATH: storage,
    DOTENV_CONFIG_PATH: resolve(storage, '.env'),
    BOOTSTRAP_ADMIN_EMAIL: undefined,
    BOOTSTRAP_ADMIN_PASSWORD: undefined,
  };
  const previous = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]]),
  );
  const testEnv = { ...process.env, ...overrides };
  delete testEnv.BOOTSTRAP_ADMIN_EMAIL;
  delete testEnv.BOOTSTRAP_ADMIN_PASSWORD;
  let client: Client | undefined;
  let app: INestApplication | undefined;
  let schemaCreated = false;
  try {
    writeFileSync(overrides.DOTENV_CONFIG_PATH!, '');
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    client = new Client({
      connectionString: clientUrl.toString(),
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    });
    await client.connect();
    if (!sharedSchema) {
      await client.query(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
      const options = {
        cwd: resolve(__dirname, '../..'),
        env: testEnv,
        encoding: 'utf8' as const,
        timeout: 120000,
      };
      const migrate = spawnSync(
        'node',
        [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
        options,
      );
      if (migrate.status !== 0)
        throw new Error(`Isolated test database migration failed (${(migrate.error as NodeJS.ErrnoException | undefined)?.code ?? migrate.status ?? 'unknown'})`);
      const hasSeedData = await copySeedData(client, schema);
      if (!hasSeedData) {
        const seed = spawnSync(
          'node',
          ['--import', 'tsx', 'prisma/seed/seed.ts'],
          { ...options, timeout: 300000 },
        );
        if (seed.status !== 0)
          throw new Error(`Isolated test database seed failed (${(seed.error as NodeJS.ErrnoException | undefined)?.code ?? seed.status ?? 'unknown'})`);
      }
      sharedSchema = schema;
      sharedClientUrl = clientUrl.toString();
    } else {
      await client.query(`SET search_path TO "${schema}"`);
      await clearExistingData(client);
    }

    const { AppModule } =
      require('../../src/app.module') as typeof import('../../src/app.module');
    app = await NestFactory.create(AppModule, {
      logger: false,
      abortOnError: false,
    });
    // Never send real email, even when a test forgets to replace this mock.
    app.get(MailService).sendOtp = async () => {};
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    await run({
      app,
      prisma: app.get(PrismaService),
      baseUrl: await app.getUrl(),
    });
  } finally {
    try {
      await app?.close();
    } finally {
      try {
        if (sharedSchema === schema) {
          await client.query(`SET search_path TO "${schema}"`);
          await clearExistingData(client);
        } else if (schemaCreated) {
          await client.query(`DROP SCHEMA "${schema}" CASCADE`);
        }
      } finally {
        try {
          await client?.end();
        } finally {
          try {
            rmSync(storage, { recursive: true, force: true });
          } finally {
            for (const [key, value] of Object.entries(previous)) {
              if (value === undefined) delete process.env[key];
              else process.env[key] = value;
            }
          }
        }
      }
    }
  }
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${baseUrl}/api${path}`, init);
  return { status: response.status, body: (await response.json()) as T };
}
