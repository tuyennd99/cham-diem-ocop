import 'reflect-metadata';
import { StreamableFile, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';
import { ApiResponseInterceptor } from './api-response.interceptor';

const makeContext = (
  method: string,
  handler: (...args: unknown[]) => unknown = () => undefined,
) =>
  ({
    getHandler: () => handler,
    switchToHttp: () => ({
      getResponse: () => ({ statusCode: 200 }),
      getRequest: () => ({ method }),
    }),
  }) as unknown as ExecutionContext;

describe('ApiResponseInterceptor', () => {
  it('keeps pagination metadata at the response top level', async () => {
    const result = await firstValueFrom(
      new ApiResponseInterceptor().intercept(makeContext('GET'), {
        handle: () =>
          of({
            data: [{ id: 1 }],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
      }),
    );

    expect(result).toEqual({
      statusCode: 200,
      data: [{ id: 1 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('does not wrap private file downloads in a JSON envelope', async () => {
    const download = new StreamableFile(Buffer.from('private-file'));

    const result = await firstValueFrom(
      new ApiResponseInterceptor().intercept(makeContext('GET'), {
        handle: () => of(download),
      }),
    );

    expect(result).toBe(download);
  });

  it('uses the @ResponseMessage decorator value when present', async () => {
    const handler = () => undefined;
    Reflect.defineMetadata(RESPONSE_MESSAGE_KEY, 'Tạo thành công', handler);

    const result = await firstValueFrom(
      new ApiResponseInterceptor().intercept(makeContext('POST', handler), {
        handle: () => of({ id: 1 }),
      }),
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { id: 1 },
      message: 'Tạo thành công',
    });
  });

  it('falls back to a verb-based message for undecorated mutations', async () => {
    const result = await firstValueFrom(
      new ApiResponseInterceptor().intercept(makeContext('DELETE'), {
        handle: () => of({ ok: true }),
      }),
    );

    expect(result).toEqual({
      statusCode: 200,
      data: { ok: true },
      message: 'Xóa thành công',
    });
  });

  it('adds no message for read (GET) requests', async () => {
    const result = await firstValueFrom(
      new ApiResponseInterceptor().intercept(makeContext('GET'), {
        handle: () => of({ id: 1 }),
      }),
    );

    expect(result).toEqual({ statusCode: 200, data: { id: 1 } });
  });
});
