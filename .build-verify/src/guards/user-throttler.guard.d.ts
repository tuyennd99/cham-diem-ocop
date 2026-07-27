import { ThrottlerGuard } from '@nestjs/throttler';
export declare class UserThrottlerGuard extends ThrottlerGuard {
    protected getTracker(request: Record<string, unknown>): Promise<string>;
}
