/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { GoogleAnalyticsService } from './google-analytics.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetPagesDto } from './dto/get-pages.dto';
import { GetByPageDto } from './dto/get-by-page.dto';
import { GetCountriesDto } from './dto/get-countries.dto';
import { GetByCountryDto } from './dto/get-by-country.dto';
import { GetOverallOrganicDto } from './dto/get-overall-organic.dto';
import { GetDailyOrganicDto } from './dto/get-daily-organic.dto';

// @ApiBearerAuth()
// @UseGuards(AuthGuard)
@ApiTags('Google Analytics')
@Controller('google-analytics')
export class GoogleAnalyticsController {
  constructor(
    private readonly googleAnalyticsService: GoogleAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Get google analytics overall' })
  @Get('overall')
  async getOverall(
    @Query() dto: GetOverallDto,
    // @Auth() user: AuthUser,
  ) {
    const data = await this.googleAnalyticsService.getOverall(
      dto,
      'test-client-id',
    );
    const message = 'google analytics overall fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics daily' })
  @Get('daily')
  async getDaily(
    @Query() dto: GetDailyDto,
    // @Auth() user: AuthUser,
  ) {
    const data = await this.googleAnalyticsService.getDaily(
      dto,
      'test-client-id',
    );
    const message = 'google analytics daily fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics countries' })
  @Get('countries')
  async getCountries(
    // @Auth() user: AuthUser,
    @Query() dto: GetCountriesDto,
  ) {
    const data = await this.googleAnalyticsService.getCountries(
      dto,
      'test-client-id',
    );
    const message = 'google analytics countries fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics by country' })
  @Get('countries/:country')
  async getByCountry(
    // @Auth() user: AuthUser,
    @Query() dto: GetByCountryDto,
    @Param('country') country: string,
  ) {
    const data = await this.googleAnalyticsService.getByCountry(
      dto,
      country,
      'test-client-id',
    );
    const message = 'google analytics country fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics by pages' })
  @Get('pages')
  async getPages(
    @Query() dto: GetPagesDto,
    // @Auth() user: AuthUser,
  ) {
    const data = await this.googleAnalyticsService.getPages(
      dto,
      'test-client-id',
    );
    const message = 'google analytics pages fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics by page' })
  @Get('pages/*page')
  async getByPage(
    // @Auth() user: AuthUser,
    @Query() dto: GetByPageDto,
    @Param('page') page: string,
  ) {
    // express v5 wildcard capture slash (/) as a comma (,)
    const prefixPage = page.startsWith(',') ? '' : ',';
    const suffixPage = page.endsWith(',') ? '' : ',';
    const rawFullPage = `${prefixPage}${page}${suffixPage}`;
    const fullPage = rawFullPage.replace(/,/g, '/');

    const data = await this.googleAnalyticsService.getByPage(
      dto,
      fullPage,
      'test-client-id',
    );
    const message = 'google analytics by page fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics overall organic traffic' })
  @Get('overall-organic')
  async getOverallOrganic(
    // @Auth() user: AuthUser,
    @Query() dto: GetOverallOrganicDto,
  ) {
    const data = await this.googleAnalyticsService.getOverallOrganic(
      dto,
      'test-client-id',
    );
    const message =
      'google analytics overall organic traffic fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics daily organic traffic' })
  @Get('daily-organic')
  async getDailyOrganic(
    // @Auth() user: AuthUser,
    @Query() dto: GetDailyOrganicDto,
  ) {
    const data = await this.googleAnalyticsService.getDailyOrganic(
      dto,
      'test-client-id',
    );
    const message =
      'google analytics daily organic traffic fetched successfully';
    return {
      message,
      data,
    };
  }
}
