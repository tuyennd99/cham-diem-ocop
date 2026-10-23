import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { catchError, from, mergeMap, of, throwError } from 'rxjs';
import type { UploadedPrivateFile } from '../types/files';
import { removeUploadedPrivateFile } from '../utils/private-storage';

@Injectable()
export class CleanupRejectedUploadInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CleanupRejectedUploadInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context
      .switchToHttp()
      .getRequest<Request & { file?: UploadedPrivateFile }>();

    return next.handle().pipe(
      catchError((originalError: unknown) => {
        if (!request.file) return throwError(() => originalError);

        return from(removeUploadedPrivateFile(request.file)).pipe(
          catchError((cleanupError: unknown) => {
            this.logger.error(
              'Failed to remove rejected product upload',
              cleanupError instanceof Error
                ? cleanupError.stack
                : String(cleanupError),
            );
            return of(undefined);
          }),
          mergeMap(() => throwError(() => originalError)),
        );
      }),
    );
  }
}
