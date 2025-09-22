import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType } from '../platform.enum';

class GoogleAnalyticsDto {
  @IsString()
  @ApiProperty({
    example: '315875115'
  })
  property_id: string;
}

class GoogleSearchConsoleDto {
  @IsEnum(PropertyType)
  @ApiProperty({
    enum: PropertyType,
    example: PropertyType.DOMAIN
  })
  property_type: PropertyType;

  @IsString()
  @ApiProperty({
    example: 'vamos.es'
  })
  property: string;
}

class GoogleAdsDto {
  @IsString()
  @ApiProperty({
    example: 'GOWa27sC8ei6F6H5l-vpGA'
  })
  manager_account_developer_token: string;

  @IsString()
  @ApiProperty({
    example: '5872255974'
  })
  customer_account_id: string;
}

export class UpsertDto {
  @ValidateNested()
  @Type(() => GoogleAnalyticsDto)
  @ApiProperty({ type: GoogleAnalyticsDto })
  google_analytics: GoogleAnalyticsDto;

  @ValidateNested()
  @Type(() => GoogleSearchConsoleDto)
  @ApiProperty({ type: GoogleSearchConsoleDto })
  google_search_console: GoogleSearchConsoleDto;

  @ValidateNested()
  @Type(() => GoogleAdsDto)
  @ApiProperty({ type: GoogleAdsDto })
  google_ads: GoogleAdsDto;
}