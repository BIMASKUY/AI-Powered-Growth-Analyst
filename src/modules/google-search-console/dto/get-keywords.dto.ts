import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetKeywordsDto {
  @ApiProperty({
    example: '2025-01-01',
  })
  start_date: string;

  @ApiPropertyOptional({
    example: '2025-01-31',
  })
  end_date: string;

  @ApiPropertyOptional({
    default: 10,
  })
  limit?: number;

  @ApiPropertyOptional({
    default: '',
    description: 'Search for a specific keyword',
  })
  search?: string;
}
