import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class GetCampaignByIdDto {
  @IsDateString({ strict: true })
  @ApiProperty({
    example: '2023-01-01',
  })
  start_date: string;

  @IsDateString({ strict: true })
  @ApiProperty({
    example: '2025-01-31',
  })
  end_date: string;
}
