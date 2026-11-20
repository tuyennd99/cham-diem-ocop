import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExceptionFilter } from './api-exception.filter';
import { validateProductApplicationForm } from '../utils/registration-snapshot';

function hostFor(request: Partial<Request>) {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn((_body: Record<string, unknown>) => undefined);
  const setHeader = jest.fn((_name: string, _value: string) => undefined);
  const response = {
    status,
    json,
    setHeader,
  } as unknown as Response;
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path: '/api/auth/login',
        ...request,
      }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, setHeader };
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
    const { host, status, json, setHeader } = hostFor({
      headers: { 'x-request-id': 'trace-123' },
      query: { token: 'query-secret' },
      body: { password: 'password-secret', otp: '123456' },
    });
    const error = Object.assign(new Error('database password-secret'), {
      code: 'P1001',
    });

    filter.catch(error, host);

    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-123');
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      requestId: 'trace-123',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('password-secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('query-secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('123456');
    const logged = (
      log.mock.calls as unknown as Array<[Record<string, unknown>]>
    )[0]?.[0];
    expect(logged).toMatchObject({
      requestId: 'trace-123',
      method: 'POST',
      path: '/api/auth/login',
      errorType: 'Error',
      errorCode: 'P1001',
    });
    expect(String(logged.errorMessage)).toContain('[REDACTED]');
    expect(typeof logged.stack).toBe('string');
  });

  it('redacts Bearer tokens and database connection strings from 5xx logs', () => {
    const { host, status } = hostFor({
      headers: { authorization: 'Bearer top.secret.jwt' },
    });
    const error = new Error(
      'Failed connecting postgresql://user:dbpass@127.0.0.1:5432/ocop with Bearer top.secret.jwt',
    );
    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(500);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('top.secret.jwt');
    expect(logged).not.toContain('dbpass');
    expect(logged).toContain('[REDACTED_DATABASE_URL]');
    expect(logged).toContain('Bearer [REDACTED]');
  });

  it('replaces an invalid request ID and preserves safe HTTP errors', () => {
    const { host, status, json, setHeader } = hostFor({
      headers: { 'x-request-id': 'bad id' },
    });
    filter.catch(new BadRequestException('Invalid input'), host);

    expect(status).toHaveBeenCalledWith(400);
    const payload = json.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      statusCode: 400,
      message: 'Invalid input',
    });
    expect(payload?.requestId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', payload?.requestId);
    expect(log).not.toHaveBeenCalled();
  });

  it('returns the missing application fields in the HTTP error message', () => {
    const { host, status, json } = hostFor({ headers: {} });
    try {
      validateProductApplicationForm({ entityName: 'Đơn vị đã nhập' });
      throw new Error('Expected validation to fail');
    } catch (error) {
      filter.catch(error, host);
    }
    expect(status).toHaveBeenCalledWith(400);
    const payload = json.mock.calls[0]?.[0];
    expect(payload?.statusCode).toBe(400);
    expect(payload?.message).toContain('thiếu người đại diện');
    expect(payload?.message).toContain('chưa xác nhận cam kết hồ sơ');
    expect(payload?.message).not.toContain('Đơn vị đã nhập');
  });

  it.each([
    ['P2000', 400, 'Giá trị đầu vào vượt quá độ dài cho phép'],
    ['P2002', 409, 'Dữ liệu đã tồn tại hoặc vi phạm ràng buộc duy nhất'],
    ['P2003', 409, 'Dữ liệu đang được tham chiếu hoặc tham chiếu không hợp lệ'],
    ['P2025', 404, 'Bản ghi yêu cầu không tồn tại'],
    ['P2034', 409, 'Xung đột dữ liệu đồng thời, vui lòng thử lại'],
  ])('maps Prisma %s error to HTTP %s', (code, statusCodeExpected, msg) => {
    const { host, status, json } = hostFor({ headers: {} });
    const prismaError = Object.assign(new Error('Prisma error detail'), {
      name: 'PrismaClientKnownRequestError',
      code,
    });
    filter.catch(prismaError, host);

    expect(status).toHaveBeenCalledWith(statusCodeExpected);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: statusCodeExpected,
        message: msg,
      }),
    );
    expect(log).not.toHaveBeenCalled();
  });
});
