import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetCountriesQueryDto {
  @ApiProperty()
  start_date: string;

  @ApiPropertyOptional({
    default: new Date().toISOString().split('T')[0],
  })
  end_date?: string;

  @ApiPropertyOptional({
    default: 1,
  })
  page?: number;

  @ApiPropertyOptional({
    default: 10,
  })
  limit?: number;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  order_by?: 'asc' | 'desc';

  @ApiPropertyOptional({
    default: '',
    description: 'Search for a specific country',
  })
  search?: string;
}
