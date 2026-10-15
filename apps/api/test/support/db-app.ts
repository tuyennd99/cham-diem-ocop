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

export async function withTestApp(
  run: (context: {
    app: INestApplication;
    prisma: PrismaService;
    baseUrl: string;
  }) => Promise<void>,
): Promise<void> {
  const message = 'TEST_DATABASE_URL must point to a local *_test database';
  let testUrl: URL;
  try {
    testUrl = new URL(process.env.TEST_DATABASE_URL ?? '');
  } catch {
    throw new Error(message);
  }
  if (
    !['postgresql:', 'postgres:'].includes(testUrl.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(testUrl.hostname) ||
    !testUrl.pathname.endsWith('_test') ||
    testUrl.searchParams.has('host') ||
    testUrl.searchParams.has('hostaddr')
  ) {
    throw new Error(message);
  }

  const schema = `ocop_test_${randomUUID().replaceAll('-', '')}`;
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
      connectionString: testUrl.toString(),
      connectionTimeoutMillis: 5000,
      query_timeout: 10000,
    });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    const options = {
      cwd: resolve(__dirname, '../..'),
      env: testEnv,
      encoding: 'utf8' as const,
      timeout: 30000,
    };
    const migrate = spawnSync(
      'node',
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      options,
    );
    if (migrate.status !== 0)
      throw new Error('Isolated test database migration failed');
    const seed = spawnSync(
      'node',
      ['--import', 'tsx', 'prisma/seed/seed.ts'],
      options,
    );
    if (seed.status !== 0)
      throw new Error('Isolated test database seed failed');

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
        if (schemaCreated)
          await client.query(`DROP SCHEMA "${schema}" CASCADE`);
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
