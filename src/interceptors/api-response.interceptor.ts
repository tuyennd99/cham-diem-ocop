import {
  CallHandler,
  ExecutionContext,
  Injectable,
  StreamableFile,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ApiSuccess } from '../types/api';

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccess<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccess<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data as unknown as ApiSuccess<T>;
        }
        const statusCode = context
          .switchToHttp()
          .getResponse<{ statusCode: number }>().statusCode;
        if (this.isPaginated(data)) {
          return {
            statusCode,
            data: data.data,
            meta: data.meta,
          } as ApiSuccess<T>;
        }
        return { statusCode, data };
      }),
    );
  }

  private isPaginated(value: unknown): value is {
    data: unknown;
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  } {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const meta = candidate.meta;
    return (
      'data' in candidate &&
      typeof meta === 'object' &&
      meta !== null &&
      ['page', 'limit', 'total', 'totalPages'].every(
        (key) => typeof (meta as Record<string, unknown>)[key] === 'number',
      )
    );
  }
}
