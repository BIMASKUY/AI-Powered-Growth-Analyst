import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateDto {
  @IsString()
  @ApiProperty()
  code: string;
}
