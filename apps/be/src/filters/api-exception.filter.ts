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

const SENSITIVE_KEY_PATTERN =
  /^(password|newPassword|currentPassword|otp|code|token|secret|authorization|credential|idToken)$/i;

function collectSensitiveValues(
  source: unknown,
  secrets: Set<string>,
  depth = 0,
) {
  if (!source || typeof source !== 'object' || depth > 2) return;
  for (const [key, value] of Object.entries(
    source as Record<string, unknown>,
  )) {
    if (
      SENSITIVE_KEY_PATTERN.test(key) &&
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      secrets.add(value.trim());
    } else if (value && typeof value === 'object') {
      collectSensitiveValues(value, secrets, depth + 1);
    }
  }
}

export function extractRequestSecrets(request: Request): string[] {
  const secrets = new Set<string>();
  collectSensitiveValues(request.body, secrets);
  collectSensitiveValues(request.query, secrets);
  collectSensitiveValues(request.headers, secrets);
  if (process.env.JWT_SECRET) secrets.add(process.env.JWT_SECRET);
  if (process.env.SMTP_PASSWORD) secrets.add(process.env.SMTP_PASSWORD);
  return [...secrets].filter((value) => value.length >= 4);
}

export function redactSensitiveText(
  input: string,
  extraSecrets: readonly string[] = [],
): string {
  let text = input
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '[REDACTED_DATABASE_URL]')
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
      '[REDACTED_JWT]',
    )
    .replace(
      /\b(password|newPassword|currentPassword|secret|otp|token|code|authorization)\b(\s*[:=-]\s*|\s+)([^\s,;'"`]+)/gi,
      '$1$2[REDACTED]',
    );
  for (const secret of extraSecrets) {
    if (secret && text.includes(secret)) {
      text = text.split(secret).join('[REDACTED]');
    }
  }
  return text;
}

const PRISMA_ERROR_RESPONSES: Record<
  string,
  { statusCode: number; message: string }
> = {
  [PRISMA_ERROR_CODE.VALUE_TOO_LONG]: {
    statusCode: HttpStatus.BAD_REQUEST,
    message: 'Giá trị đầu vào vượt quá độ dài cho phép',
  },
  [PRISMA_ERROR_CODE.UNIQUE_CONSTRAINT]: {
    statusCode: HttpStatus.CONFLICT,
    message: 'Dữ liệu đã tồn tại hoặc vi phạm ràng buộc duy nhất',
  },
  [PRISMA_ERROR_CODE.FOREIGN_KEY_CONSTRAINT]: {
    statusCode: HttpStatus.CONFLICT,
    message: 'Dữ liệu đang được tham chiếu hoặc tham chiếu không hợp lệ',
  },
  [PRISMA_ERROR_CODE.RECORD_NOT_FOUND]: {
    statusCode: HttpStatus.NOT_FOUND,
    message: 'Bản ghi yêu cầu không tồn tại',
  },
  [PRISMA_ERROR_CODE.WRITE_CONFLICT]: {
    statusCode: HttpStatus.CONFLICT,
    message: 'Xung đột dữ liệu đồng thời, vui lòng thử lại',
  },
};

function extractHttpExceptionMessage(
  exception: HttpException,
  request: Request,
): string {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  const rawMessage = (body as { message?: unknown } | undefined)?.message;
  if (Array.isArray(rawMessage)) return rawMessage.map(String).join(', ');
  if (typeof rawMessage === 'string') return rawMessage;
  return `${request.method} ${request.path} failed`;
}

function resolveErrorResponse(
  exception: unknown,
  request: Request,
  rawCode: string | undefined,
): { statusCode: number; message: string } {
  if (exception instanceof HttpException) {
    return {
      statusCode: exception.getStatus(),
      message: extractHttpExceptionMessage(exception, request),
    };
  }
  if (rawCode && /^P\d{4}$/.test(rawCode)) {
    const mapped = PRISMA_ERROR_RESPONSES[rawCode];
    if (mapped) return mapped;
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
  };
}

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

    const rawCode =
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof exception.code === 'string'
        ? exception.code
        : undefined;
    const { statusCode, message } = resolveErrorResponse(
      exception,
      request,
      rawCode,
    );

    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      const secrets = extractRequestSecrets(request);
      this.logger.error({
        requestId,
        method: request.method,
        path: request.path,
        errorType: exception instanceof Error ? exception.name : 'UnknownError',
        ...(rawCode ? { errorCode: rawCode } : {}),
        ...(exception instanceof Error
          ? {
              errorMessage: redactSensitiveText(exception.message, secrets),
              ...(exception.stack
                ? { stack: redactSensitiveText(exception.stack, secrets) }
                : {}),
            }
          : {}),
      });
    }

    const payload: ApiError = { statusCode, message, requestId };
    response.status(statusCode).json(payload);
  }
}
