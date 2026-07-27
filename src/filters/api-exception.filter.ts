import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { ApiError } from '../types/api';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status: HttpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body: Record<string, unknown> =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
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
    const suppliedRequestId = request.header('x-request-id');
    const requestId =
      suppliedRequestId && /^[A-Za-z0-9._-]{1,100}$/.test(suppliedRequestId)
        ? suppliedRequestId
        : randomUUID();
    const payload: ApiError = {
      statusCode: status,
      errorCode,
      message,
      requestId,
      ...(body.details === undefined ? {} : { details: body.details }),
    };

    response.status(status).json(payload);
  }
}
