import { Module } from '@nestjs/common';
import appModules from './modules';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { TaskStatusJob } from './jobs/task-status.job';
import { PrismaService } from './prisma/prisma.service';
import { appControllers } from './controllers';
import { appServices } from './services';
import { appRepositories } from './repositories';

@Module({
  imports: appModules,
  controllers: appControllers,
  providers: [
    ...appRepositories,
    ...appServices,
    PrismaService,
    TaskStatusJob,
    CsrfGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
