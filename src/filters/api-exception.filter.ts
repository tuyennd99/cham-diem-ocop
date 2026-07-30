import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { isObjectLike } from 'lodash';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';
import { ApiError } from '../types/api';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    if (exception instanceof ZodValidationException) {
      const issues = (exception.getZodError() as ZodError).issues;
      const message = issues
        .map((i) => {
          const field = i.path.join('.');
          return field ? `${field}: ${i.message}` : i.message;
        })
        .join(', ');
      const payload: ApiError = {
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'VALIDATION_ERROR',
        message: message || 'Request failed',
        requestId: this.requestId(request),
        details: issues,
      };
      response.status(HttpStatus.BAD_REQUEST).json(payload);
      return;
    }

    const status: HttpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: Record<string, unknown> = isObjectLike(exceptionResponse)
      ? (exceptionResponse as Record<string, unknown>)
      : {};
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : Array.isArray(body.message)
          ? body.message.join(', ')
          : typeof body.message === 'string'
            ? body.message
            : status === HttpStatus.INTERNAL_SERVER_ERROR
              ? 'Internal server error'
              : 'Request failed';
    const errorCode =
      typeof body.errorCode === 'string'
        ? body.errorCode
        : status === HttpStatus.BAD_REQUEST
          ? 'VALIDATION_ERROR'
          : status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'INTERNAL_SERVER_ERROR'
            : `HTTP_${status}`;
    const payload: ApiError = {
      statusCode: status,
      errorCode,
      message,
      requestId: this.requestId(request),
      ...(body.details === undefined ? {} : { details: body.details }),
    };

    response.status(status).json(payload);
  }

  private requestId(request: Request): string {
    const supplied = request.header('x-request-id');
    return supplied && /^[A-Za-z0-9._-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  }
}
