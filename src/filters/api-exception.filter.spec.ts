import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  it('returns the API error contract for validation failures', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ header: () => 'request-1' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(
      new BadRequestException({
        message: ['name must be a string'],
        details: ['name'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'name must be a string',
      details: ['name'],
      requestId: 'request-1',
    });
  });

  it('does not reflect an invalid request id', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ header: () => 'x'.repeat(101) }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(new BadRequestException(), host);

    const payload = (json.mock.calls as unknown[][])[0][0] as {
      requestId: string;
    };
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
