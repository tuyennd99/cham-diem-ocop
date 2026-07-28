import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app';
import { AuthService } from '../src/services/auth.service';
import { SystemRepository } from '../src/repositories/system.repository';
import { RequestMeta } from '../src/types/auth';

const authResult = {
  accessToken: 'access-token',
  expiresIn: 900,
  refreshToken: 'raw-refresh-token',
  refreshExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60_000),
  csrfToken: 'signed.csrf-token',
  user: {
    id: 1,
    username: 'user',
    fullName: 'Test User',
    organizationId: 10,
    organization: { id: 10, code: 'UNIT', name: 'Test Unit' },
    permissions: ['tasks.read'],
  },
};

describe('Auth endpoints', () => {
  let app: INestApplication;
  let server: Server;
  let accessToken: string;
  let observedRefresh:
    [rawToken: string, csrfToken: string, meta: RequestMeta] | undefined;
  const authService = {
    login: jest.fn().mockResolvedValue(authResult),
    refresh: jest.fn(
      (rawToken: string, csrfToken: string, meta: RequestMeta) => {
        observedRefresh = [rawToken, csrfToken, meta];
        return Promise.resolve(authResult);
      },
    ),
    logout: jest.fn().mockResolvedValue(undefined),
    profile: jest.fn().mockResolvedValue(authResult.user),
    changePassword: jest.fn().mockResolvedValue(undefined),
    assertCsrfToken: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    process.env.DISABLE_SCHEDULER = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authService)
      .overrideProvider(SystemRepository)
      .useValue({
        listEffectivePermissions: jest.fn().mockResolvedValue({
          status: 'ACTIVE',
          isAdmin: false,
          organizationId: 10,
          permissions: ['tasks.read'],
        }),
      })
      .compile();
    accessToken = await moduleRef.get(JwtService).signAsync(
      {
        sub: 1,
        username: 'user',
        organizationId: 10,
        permissions: ['tasks.read'],
      },
      {
        secret: process.env.JWT_SECRET,
        algorithm: 'HS256',
        issuer: 'congan-api',
        audience: 'congan-web',
        expiresIn: '15m',
      },
    );

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in without exposing the refresh token in the response', async () => {
    await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'user', password: 'correct-password' })
      .expect(200)
      .expect(({ body: unsafeBody, headers }) => {
        const body: unknown = unsafeBody;
        expect(body).toMatchObject({
          data: {
            accessToken: 'access-token',
            expiresIn: 900,
            user: { username: 'user' },
          },
        });
        expect(JSON.stringify(body)).not.toContain('raw-refresh-token');
        const cookies = headers['set-cookie'] as unknown as string[];
        expect(cookies).toEqual(
          expect.arrayContaining([
            expect.stringMatching(
              /^refresh_token=raw-refresh-token; Max-Age=259(?:19\d|200); Path=\/api\/v1\/auth; Expires=.*; HttpOnly; SameSite=Lax$/,
            ),
            expect.stringMatching(
              /^csrf_token=signed\.csrf-token; Max-Age=259(?:19\d|200); Path=\/; Expires=.*; SameSite=Lax$/,
            ),
          ]),
        );
      });
  });

  it('allows the CSRF header in CORS preflight', async () => {
    await request(server)
      .options('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'x-csrf-token')
      .expect(204)
      .expect('Access-Control-Allow-Headers', /(?:^|,\s*)x-csrf-token(?:,|$)/i);
  });

  it('rejects refresh without an exact allowlisted Origin', async () => {
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173.evil.example')
      .set('x-csrf-token', 'signed.csrf-token')
      .set(
        'Cookie',
        'refresh_token=raw-refresh-token; csrf_token=signed.csrf-token',
      )
      .expect(403);
  });

  it('rejects refresh when CSRF cookie and header differ', async () => {
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', 'signed.csrf-token')
      .set('Cookie', 'refresh_token=raw-refresh-token; csrf_token=other')
      .expect(403);
  });

  it('rotates refresh with matching signed CSRF and allowed Origin', async () => {
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', 'signed.csrf-token')
      .set(
        'Cookie',
        'refresh_token=raw-refresh-token; csrf_token=signed.csrf-token',
      )
      .expect(200);
    expect(observedRefresh?.slice(0, 2)).toEqual([
      'raw-refresh-token',
      'signed.csrf-token',
    ]);
    expect(typeof observedRefresh?.[2].ipAddress).toBe('string');
  });

  it('keeps health public while protecting profile', async () => {
    await request(server).get('/api/v1/system/health/live').expect(200);
    await request(server).get('/api/v1/auth/profile').expect(401);
  });

  it('does not expose a registration endpoint', async () => {
    await request(server)
      .post('/api/v1/auth/register')
      .send({ username: 'new-user', password: 'password' })
      .expect(404);
  });

  it('throttles password changes to five attempts per minute per IP', async () => {
    const send = () =>
      request(server)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'current-password',
          newPassword: 'new-password-value',
        });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await send().expect(200);
    }
    await send().expect(429);
  });
});
