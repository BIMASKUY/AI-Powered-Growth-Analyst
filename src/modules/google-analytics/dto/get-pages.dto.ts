import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetPagesDto {
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
    example: 'bmw',
  })
  search: string;
}
