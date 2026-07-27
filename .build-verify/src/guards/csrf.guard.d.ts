import { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
export declare class CsrfGuard implements CanActivate {
    private readonly authService;
    constructor(authService: AuthService);
    canActivate(context: ExecutionContext): boolean;
    private equal;
    private forbidden;
}
