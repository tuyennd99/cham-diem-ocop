import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { env } from '../config/env';

export default [
  ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  JwtModule.registerAsync({
    useFactory: () => ({ secret: env(process.env).jwtSecret }),
  }),
];
