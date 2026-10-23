import { Transform, Type } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  AdminUserQuery,
  CreateAdminUserInput,
  ResetAdminUserPasswordInput,
  UpdateAdminUserProfileInput,
  UpdateAdminUserStatusInput,
  CreateOrganizationUnitInput,
  OrganizationUnitQuery,
  UpdateOrganizationUnitInput,
} from '@ocop/shared';
import { StaffPermission } from '@prisma/client';

const trimString = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;
const normalizedEmail = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
const strictBoolean = ({ value }: TransformFnParams) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class OrganizationUnitsQueryDto implements OrganizationUnitQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  q?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;
}

export class CreateOrganizationUnitDto implements CreateOrganizationUnitInput {
  @ApiProperty({ minLength: 1, maxLength: 50 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string | null;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  order!: number;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class UpdateOrganizationUnitDto implements UpdateOrganizationUnitInput {
  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(0)
  order?: number;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class AdminUsersQueryDto implements AdminUserQuery {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimString)
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: StaffPermission })
  @IsOptional()
  @IsEnum(StaffPermission)
  permission?: StaffPermission;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  organizationUnitId?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(strictBoolean)
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ enum: ['STAFF', 'REGISTRANT'] })
  @IsOptional()
  @IsEnum(['STAFF', 'REGISTRANT'])
  kind?: 'STAFF' | 'REGISTRANT';
}

export class CreateAdminUserDto implements CreateAdminUserInput {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(normalizedEmail)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiProperty({ minLength: 12, maxLength: 72 })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  organizationUnitId!: string;

  @ApiProperty({ enum: StaffPermission, isArray: true, uniqueItems: true, minItems: 1, maxItems: 3 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(StaffPermission, { each: true })
  staffPermissions!: StaffPermission[];

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class UpdateAdminUserProfileDto implements UpdateAdminUserProfileInput {
  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class UpdateAdminUserStatusDto implements UpdateAdminUserStatusInput {
  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class ResetAdminUserPasswordDto implements ResetAdminUserPasswordInput {
  @ApiProperty({ minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}
