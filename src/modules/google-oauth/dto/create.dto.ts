import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateDto {
  @IsString()
  @ApiProperty({
    example: '4/0AVGzR1DujNLUnx3rhX6MUf3hh3VX65w9X9Eb9h8T_2G_iGucJQszbTYwXNrtg1DGSjSgXg'
  })
  code: string;
}
