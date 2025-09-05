import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetCountriesDto {
  @ApiProperty({
    example: '2025-01-01',
  })
  start_date: string;

  @ApiProperty({
    example: '2025-01-31',
  })
  end_date: string;

  @ApiPropertyOptional({
    default: 10,
  })
  limit: number;

  @ApiPropertyOptional({
    default: '',
    example: 'es',
    description: 'Filter countries contain this search term (case insensitive)',
  })
  search: string;
}
