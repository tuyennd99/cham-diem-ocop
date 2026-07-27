import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { TaskStatusJob } from './jobs/task-status.job';
import { PrismaService } from './prisma/prisma.service';
import { convertObjectToArray } from './utils/convert-object-to-array.util';
import * as appControllers from './controllers';
import * as appServices from './services';
import * as appRepositories from './repositories';
import { RoutesConfiguration } from './middlewares/routes/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: convertObjectToArray(appControllers),
  providers: [
    ...convertObjectToArray(appRepositories),
    ...convertObjectToArray(appServices),
    PrismaService,
    TaskStatusJob,
    CsrfGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    RoutesConfiguration.configure(consumer);
  }
}
