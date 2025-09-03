import { ApiProperty } from '@nestjs/swagger';

export class GetCampaignByIdDto {
  @ApiProperty({
    example: '2023-01-01',
  })
  start_date: string;

  @ApiProperty({
    example: '2025-01-31',
  })
  end_date: string;
}
