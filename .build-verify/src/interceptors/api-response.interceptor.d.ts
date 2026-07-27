import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiSuccess } from '../types/api';
export declare class ApiResponseInterceptor<T> implements NestInterceptor<T, ApiSuccess<T>> {
    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccess<T>>;
    private isPaginated;
}
