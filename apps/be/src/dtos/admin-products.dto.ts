import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ProductUpdateDto, ProductWriteDto } from './products.dto';

const trimText = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AdminProductCreateDto extends ProductWriteDto {
  @ApiProperty({ maxLength: 100 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  registrantId!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class AdminProductUpdateDto extends ProductUpdateDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class ProductMutationReasonDto {
  @ApiProperty({ minLength: 1, maxLength: 255 })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}
