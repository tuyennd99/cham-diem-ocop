import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StaffPermission } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const normalizedEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class UpdateStaffAccessDto {
  @ApiProperty({ enum: StaffPermission, isArray: true, uniqueItems: true, maxItems: 3 })
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsEnum(StaffPermission, { each: true })
  staffPermissions!: StaffPermission[];

  @ApiProperty({ nullable: true, maxLength: 100 })
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  organizationUnitId!: string | null;

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

export class CreateJudgeDto {
  @ApiProperty({ format: 'email', maxLength: 320 })
  @Transform(normalizedEmail)
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
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

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class UpdateJudgeDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
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

export class ResetJudgePasswordDto {
  @ApiProperty({ minLength: 12, maxLength: 72 })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class DeactivateJudgeDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class AssignmentInputDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  judgeId!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  categoryId!: string;

  @ApiProperty({ type: [String], maxItems: 100, uniqueItems: true })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  criterionIds!: string[];
}

export class ReplaceAssignmentsDto {
  @ApiProperty({
    type: () => [AssignmentInputDto],
    maxItems: 10000,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMaxSize(10000)
  @ArrayUnique(
    (item: AssignmentInputDto | null) => `${item?.judgeId}:${item?.categoryId}`,
  )
  @ValidateNested({ each: true })
  @Type(() => AssignmentInputDto)
  assignments!: AssignmentInputDto[];

  @ApiPropertyOptional({ maxLength: 255 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(255)
  reason?: string;
}
