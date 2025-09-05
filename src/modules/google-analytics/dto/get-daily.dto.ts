import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class GetDailyDto {
  @IsDateString({ strict: true })
  @ApiProperty({
    example: '2025-01-01',
  })
  start_date: string;

  @IsDateString({ strict: true })
  @ApiProperty({
    example: '2025-01-31',
  })
  end_date: string;
}
