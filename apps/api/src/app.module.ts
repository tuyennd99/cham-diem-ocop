import { Module } from '@nestjs/common';
import appModules from './modules';
import { APP_GUARD } from '@nestjs/core';
import { AccountGuard } from './guards/account.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RoleGuard } from './guards/role.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { PrismaService } from './prisma/prisma.service';
import { appControllers } from './controllers';
import { appServices } from './services';
import { appRepositories } from './repositories';
import { MailService } from './services/mail.service';
import { OtpService } from './services/otp.service';

@Module({
  imports: appModules,
  controllers: appControllers,
  providers: [
    ...appRepositories,
    ...appServices,
    PrismaService,
    MailService,
    OtpService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: AccountGuard },
    { provide: APP_GUARD, useClass: RoleGuard },
  ],
})
export class AppModule {}
