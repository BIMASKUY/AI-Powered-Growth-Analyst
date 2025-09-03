import { ApiProperty } from '@nestjs/swagger';

export class GetByCountryParamDto {
  @ApiProperty()
  country: string;
}
