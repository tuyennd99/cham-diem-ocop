import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../types/api';
import { requestMeta } from '../utils/request-meta';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof body === 'string'
      ? body
      : Array.isArray((body as { message?: unknown[] } | undefined)?.message)
        ? ((body as { message: unknown[] }).message).map(String).join(', ')
        : typeof (body as { message?: unknown } | undefined)?.message === 'string'
          ? String((body as { message: string }).message)
          : statusCode === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Internal server error'
            : `${request.method} ${request.path} failed`;
    const requestId = requestMeta(request).requestId;
    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorCode = typeof exception === 'object' && exception !== null && 'code' in exception
        ? String(exception.code)
        : undefined;
      this.logger.error({
        requestId,
        method: request.method,
        path: request.path,
        errorType: exception instanceof Error ? exception.name : 'UnknownError',
        ...(errorCode ? { errorCode } : {}),
      });
    }
    const payload: ApiError = { statusCode, message, requestId };
    response.status(statusCode).json(payload);
  }
}
