import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';

function hostFor(request: Partial<Request>) {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', path: '/api/auth/login', ...request }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('ApiExceptionFilter', () => {
  let filter: ApiExceptionFilter;
  let log: jest.SpyInstance;

  beforeEach(() => {
    filter = new ApiExceptionFilter();
    log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns a safe internal error, propagates a valid request ID, and logs no exception contents', () => {
    const { host, response } = hostFor({
      headers: { 'x-request-id': 'trace-123' } as Request['headers'],
      query: { token: 'query-secret' },
      body: { password: 'password-secret', otp: '123456' },
    });
    const error = Object.assign(new Error('database password-secret'), { code: 'P1001' });

    filter.catch(error, host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      requestId: 'trace-123',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('password-secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('query-secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('123456');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      requestId: 'trace-123',
      method: 'POST',
      path: '/api/auth/login',
      errorType: 'Error',
      errorCode: 'P1001',
    }));
  });

  it('replaces an invalid request ID and preserves safe HTTP errors', () => {
    const { host, response } = hostFor({ headers: { 'x-request-id': 'bad id' } as Request['headers'] });
    filter.catch(new BadRequestException('Invalid input'), host);

    expect(response.status).toHaveBeenCalledWith(400);
    const payload = (response.json as jest.Mock).mock.calls[0][0];
    expect(payload).toMatchObject({ statusCode: 400, message: 'Invalid input' });
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(log).not.toHaveBeenCalled();
  });
});
