import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app';

describe('Health endpoints', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    process.env.DISABLE_SCHEDULER = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the live status using the API response contract', async () => {
    await request(server)
      .get('/api/v1/system/health/live')
      .set('Origin', 'http://localhost:5173')
      .expect(200)
      .expect('access-control-allow-origin', 'http://localhost:5173')
      .expect('x-content-type-options', 'nosniff')
      .expect({ statusCode: 200, data: { status: 'ok' } });
  });

  it('returns the ready status using the API response contract', async () => {
    await request(server)
      .get('/api/v1/system/health/ready')
      .expect(200)
      .expect({ statusCode: 200, data: { status: 'ok' } });
  });

  it('uses the API error contract for unknown prefixed routes', async () => {
    await request(server)
      .get('/api/v1/system/health/missing')
      .expect(404)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          statusCode: 404,
          errorCode: 'HTTP_404',
        });
      });
  });
});
