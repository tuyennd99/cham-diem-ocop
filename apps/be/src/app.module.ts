import { Module } from '@nestjs/common';
import appModules from './modules';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { AccountGuard } from './guards/account.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from './guards/role.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { ApiResponseInterceptor } from './interceptors/api-response.interceptor';
import { CleanupRejectedUploadInterceptor } from './interceptors/cleanup-rejected-upload.interceptor';
import { PrismaService } from './prisma/prisma.service';
import { appControllers } from './controllers';
import { appServices } from './services';
import { appRepositories } from './repositories';
import { MailService } from './services/mail.service';
import { OtpService } from './services/otp.service';
import { GoogleIdentityService } from './services/google-identity.service';

@Module({
  imports: appModules,
  controllers: appControllers,
  providers: [
    ...appRepositories,
    ...appServices,
    PrismaService,
    MailService,
    OtpService,
    GoogleIdentityService,
    CleanupRejectedUploadInterceptor,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: AccountGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule {}
