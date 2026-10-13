import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { env } from '../config/env';

export default [
  ScheduleModule.forRoot(),
  ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  JwtModule.registerAsync({
    useFactory: () => ({ secret: env(process.env).jwtSecret }),
  }),
];
