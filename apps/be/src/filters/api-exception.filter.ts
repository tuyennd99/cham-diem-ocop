import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PRISMA_ERROR_CODE } from '../constants/auth';
import { ApiError } from '../types/api';
import { requestMeta } from '../utils/request-meta';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const meta = requestMeta(request);
    const requestId = meta.requestId;

    if (requestId && typeof response.setHeader === 'function') {
      response.setHeader('x-request-id', requestId);
    }

    let statusCode: number;
    let message: string;

    const isPrismaError =
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as { code: unknown }).code === 'string';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string'
        ? body
        : Array.isArray((body as { message?: unknown[] } | undefined)?.message)
          ? ((body as { message: unknown[] }).message).map(String).join(', ')
          : typeof (body as { message?: unknown } | undefined)?.message === 'string'
            ? String((body as { message: string }).message)
            : `${request.method} ${request.path} failed`;
    } else if (isPrismaError) {
      const code = String((exception as { code: string }).code);
      if (code === PRISMA_ERROR_CODE.VALUE_TOO_LONG) {
        statusCode = HttpStatus.BAD_REQUEST;
        message = 'Giá trị đầu vào vượt quá độ dài cho phép';
      } else if (code === PRISMA_ERROR_CODE.UNIQUE_CONSTRAINT) {
        statusCode = HttpStatus.CONFLICT;
        message = 'Dữ liệu đã tồn tại hoặc vi phạm ràng buộc duy nhất';
      } else if (code === PRISMA_ERROR_CODE.RECORD_NOT_FOUND) {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Bản ghi yêu cầu không tồn tại';
      } else {
        statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Internal server error';
      }
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorCode = isPrismaError
        ? String((exception as { code: string }).code)
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
