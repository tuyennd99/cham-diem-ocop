import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class EvaluationScoreDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  subCriterionId!: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  optionId!: string;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class SaveEvaluationDto {
  @ApiProperty({ type: () => [EvaluationScoreDto], maxItems: 1000 })
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique((score: EvaluationScoreDto | null) => score?.subCriterionId)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreDto)
  scores!: EvaluationScoreDto[];
}
