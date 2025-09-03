import { ApiProperty } from '@nestjs/swagger';

export class GetKeywordParamDto {
  @ApiProperty()
  keyword: string;
}
