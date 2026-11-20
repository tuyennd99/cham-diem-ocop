import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import { GOOGLE_AUTH_INTENT, type GoogleAuthIntent } from '../constants/auth';
import {
  normalizedEmail,
  trimNullableOptional,
  trimRequired,
} from './common.dto';

const googleAuthIntents = [
  GOOGLE_AUTH_INTENT.LOGIN,
  GOOGLE_AUTH_INTENT.REGISTER,
] as const;

export class EmailDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(normalizedEmail)
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class GoogleLoginDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  challengeToken!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(16384)
  credential!: string;

  @ApiProperty({ enum: googleAuthIntents })
  @IsIn(googleAuthIntents)
  intent!: GoogleAuthIntent;
}

export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @Transform(trimRequired)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class LoginDto extends EmailDto {
  @ApiProperty({ minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}

export class RegistrationTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  registrationToken!: string;
}

export class GoogleRegisterDto extends RegistrationTokenDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @Transform(trimRequired)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class VerifyOtpDto extends RegistrationTokenDto {
  @ApiProperty({ pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class LegacyVerifyOtpDto extends EmailDto {
  @ApiProperty({ pattern: '^\\d{6}$' })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}

export class ResetPasswordDto extends LegacyVerifyOtpDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimRequired)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @Transform(trimNullableOptional)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;
}
