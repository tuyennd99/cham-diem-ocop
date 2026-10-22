import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import type { RequestMeta } from '../types/auth';

export function requestMeta(request: Request): RequestMeta {
  const requestId = request.headers['x-request-id'];
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
    requestId:
      typeof requestId === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(requestId)
        ? requestId
        : randomUUID(),
  };
}
