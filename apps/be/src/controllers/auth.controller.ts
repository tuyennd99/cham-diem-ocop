import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, UnsupportedMediaTypeException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public } from '../decorators/public.decorator';
import { ChangePasswordDto, EmailDto, GoogleLoginDto, GoogleRegisterDto, LegacyVerifyOtpDto, LoginDto, RegisterDto, RegistrationTokenDto, ResetPasswordDto, VerifyOtpDto } from '../dtos/auth.dto';
import { env } from '../config/env';
import { AuthService } from '../services/auth.service';
import type { AccessTokenPayload } from '../types/auth';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google/challenge')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  googleChallenge(@Headers('origin') origin: string, @Headers('content-type') contentType: string) {
    this.assertGoogleRequest(origin, contentType);
    return this.authService.googleChallenge();
  }

  @Public()
  @Post('google')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  google(@Body() body: GoogleLoginDto, @Headers('origin') origin: string, @Headers('content-type') contentType: string) {
    this.assertGoogleRequest(origin, contentType);
    return this.authService.google(body);
  }

  @Public()
  @Post('google/register')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  googleRegister(@Body() body: GoogleRegisterDto, @Headers('origin') origin: string, @Headers('content-type') contentType: string) {
    this.assertGoogleRequest(origin, contentType);
    return this.authService.googleRegister(body);
  }

  @Public()
  @Post('google/link/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  googleLinkVerify(@Body() body: VerifyOtpDto, @Headers('origin') origin: string, @Headers('content-type') contentType: string) {
    this.assertGoogleRequest(origin, contentType);
    return this.authService.googleLinkVerify(body.registrationToken, body.code);
  }

  @Public()
  @Post('google/link/resend')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  googleLinkResend(@Body() body: RegistrationTokenDto, @Headers('origin') origin: string, @Headers('content-type') contentType: string) {
    this.assertGoogleRequest(origin, contentType);
    return this.authService.googleLinkResend(body.registrationToken);
  }

  private assertGoogleRequest(origin: string, contentType: string) {
    if (!origin || !env(process.env).allowedOrigins.includes(origin)) throw new ForbiddenException('Origin is not allowed');
    if (contentType?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new UnsupportedMediaTypeException('Google sign-in requires JSON');
  }

  @Public()
  @Post('register')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.authService.verifyOtp(body.registrationToken, body.code);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  resendOtp(@Body() body: RegistrationTokenDto) {
    return this.authService.resendRegistrationOtp(body.registrationToken);
  }

  @Public()
  @Post('registration-status')
  @HttpCode(200)
  registrationStatus(@Body() body: RegistrationTokenDto) {
    return this.authService.registrationStatus(body.registrationToken);
  }

  @Public()
  @Post('legacy-registration/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  verifyLegacyRegistration(@Body() body: LegacyVerifyOtpDto) {
    return this.authService.verifyLegacyRegistration(body.email, body.code);
  }

  @Public()
  @Post('legacy-registration/resend')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  resendLegacyRegistration(@Body() body: EmailDto) {
    return this.authService.resendLegacyRegistrationOtp(body.email);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  forgotPassword(@Body() body: EmailDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }

  @Get('me')
  @ApiBearerAuth()
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.me(user.sub);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@Body() body: ChangePasswordDto, @CurrentUser() user: AccessTokenPayload) {
    return this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }
}
