import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GetKeywordsDto {
  @IsDateString()
  @ApiProperty({
    example: '2025-01-01',
  })
  start_date: string;

  @IsDateString()
  @ApiProperty({
    example: '2025-01-31',
  })
  end_date: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @ApiPropertyOptional({
    default: 10,
  })
  limit: number = 10;

  @IsOptional()
  @IsString()
  @Type(() => String)
  @Transform((req) => {
    const value = req.value as string;
    return value.toLowerCase();
  })
  @ApiPropertyOptional({
    default: '',
    description: 'Filter keywords contain this search term (case insensitive)',
  })
  search: string = '';
}
