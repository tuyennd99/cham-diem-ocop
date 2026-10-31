import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class EmailDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}

export class RegisterDto extends EmailDto {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
