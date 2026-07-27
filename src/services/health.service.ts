import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  live() {
    return { status: 'ok' as const };
  }

  ready() {
    return { status: 'ok' as const };
  }
}
