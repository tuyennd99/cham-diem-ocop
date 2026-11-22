import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { env } from '../config/env';
import { RedisService } from '../services/redis.service';
import { RedisModule } from './redis.module';
import { RedisThrottlerStorage } from './redis-throttler.storage';

export default [
  RedisModule,
  ThrottlerModule.forRootAsync({
    imports: [RedisModule],
    inject: [RedisService],
    useFactory: (redisService: RedisService) => ({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      storage: new RedisThrottlerStorage(redisService),
    }),
  }),
  JwtModule.registerAsync({
    useFactory: () => ({ secret: env(process.env).jwtSecret }),
  }),
];
