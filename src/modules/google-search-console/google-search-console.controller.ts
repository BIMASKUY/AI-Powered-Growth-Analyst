import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { GoogleSearchConsoleService } from './google-search-console.service';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Auth } from '../auth/auth.decorator';
import { AuthUser } from '../auth/auth.type';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetKeywordsDto } from './dto/get-keywords.dto';
import { GetByKeywordDto } from './dto/get-by-keyword.dto';
import { GetCountriesDto } from './dto/get-countries.dto';
import { GetByCountryDto } from './dto/get-by-country.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@ApiTags('Google Search Console')
@Controller('google-search-console')
export class GoogleSearchConsoleController {
  constructor(
    private readonly googleSearchConsoleService: GoogleSearchConsoleService,
  ) {}

  @ApiOperation({ summary: 'Get google search console overall' })
  @Get('overall')
  async getOverall(@Auth() user: AuthUser, @Query() dto: GetOverallDto) {
    const data = await this.googleSearchConsoleService.getOverall(dto, user.id);
    const message = 'google search console overall fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console daily' })
  @Get('daily')
  async getDaily(@Auth() user: AuthUser, @Query() dto: GetDailyDto) {
    const data = await this.googleSearchConsoleService.getDaily(dto, user.id);
    const message = 'google search console daily fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console keywords' })
  @Get('keywords')
  async getKeywords(@Auth() user: AuthUser, @Query() dto: GetKeywordsDto) {
    const data = await this.googleSearchConsoleService.getKeywords(
      dto,
      user.id,
    );
    const message = 'google search console keywords fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console by keyword' })
  @ApiParam({
    name: 'keyword',
    description: 'Should be exact keyword',
    example: 'bmw x8',
    type: String,
  })
  @Get('keywords/:keyword')
  async getByKeyword(
    @Auth() user: AuthUser,
    @Query() dto: GetByKeywordDto,
    @Param('keyword') keyword: string,
  ) {
    const data = await this.googleSearchConsoleService.getByKeyword(
      dto,
      keyword,
      user.id,
    );
    const message = 'google search console by keyword fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console countries' })
  @Get('countries')
  async getCountries(@Auth() user: AuthUser, @Query() dto: GetCountriesDto) {
    const data = await this.googleSearchConsoleService.getCountries(
      dto,
      user.id,
    );
    const message = 'google search console countries fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console by country' })
  @Get('countries/:country')
  @ApiParam({
    name: 'country',
    description: 'Can be partial country name but should be unique',
    example: 'spain',
    type: String,
  })
  async getByCountry(
    @Auth() user: AuthUser,
    @Query() dto: GetByCountryDto,
    @Param('country') country: string,
  ) {
    const data = await this.googleSearchConsoleService.getByCountry(
      dto,
      country,
      user.id,
    );
    const message = 'google search console by country fetched successfully';
    return {
      message,
      data,
    };
  }
}
