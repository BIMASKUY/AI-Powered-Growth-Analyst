import { ApiProperty } from '@nestjs/swagger';

export class GetOverallCampaignsDto {
  @ApiProperty({
    example: '2025-01-01',
  })
  start_date: string;

  @ApiProperty({
    example: '2025-01-31',
  })
  end_date: string;
}
