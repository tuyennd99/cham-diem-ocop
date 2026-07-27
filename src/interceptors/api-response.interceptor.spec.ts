import { StreamableFile, type ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponseInterceptor } from './api-response.interceptor';

describe('ApiResponseInterceptor', () => {
  const context = {
    switchToHttp: () => ({
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;

  it('keeps pagination metadata at the response top level', async () => {
    const result = await firstValueFrom(
      new ApiResponseInterceptor().intercept(context, {
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
      new ApiResponseInterceptor().intercept(context, {
        handle: () => of(download),
      }),
    );

    expect(result).toBe(download);
  });
});
