import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { GoogleAnalyticsService } from './google-analytics.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetPagesDto } from './dto/get-pages.dto';

// @ApiBearerAuth()
// @UseGuards(AuthGuard)
@ApiTags('Google Analytics')
@Controller('google-analytics')
export class GoogleAnalyticsController {
  constructor(
    private readonly googleAnalyticsService: GoogleAnalyticsService,
  ) {}

  @ApiOperation({ summary: 'Get google analytics overall data' })
  @Get('overall')
  async getOverall(@Query() dto: GetOverallDto) {
    const data = await this.googleAnalyticsService.getOverall(
      dto,
      'test-client-id',
    );
    const message = 'google analytics overall data fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google analytics daily data' })
  @Get('daily')
  async getDaily(@Query() dto: GetDailyDto) {
    const data = await this.googleAnalyticsService.getDaily(
      dto,
      'test-client-id',
    );
    const message = 'google analytics daily data fetched successfully';
    return {
      message,
      data,
    };
  }

  // @ApiOperation({ summary: 'Get google analytics by countries' })
  // @Get('analytics/countries')
  // async getByCountries(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetByCountriesQueryDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleAnalyticsService.getByCountries(
  //       query,
  //       user.user_metadata.client_id,
  //     );
  //   const message = 'google analytics countries fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }

  // @ApiOperation({ summary: 'Get google analytics by country' })
  // @Get('analytics/countries/:country')
  // async getByCountry(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetByCountryQueryDto,
  //   @Param() param: GetByCountryParamDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleAnalyticsService.getByCountry(
  //       query,
  //       user.user_metadata.client_id,
  //       param.country,
  //     );
  //   const message = 'google analytics country fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }

  @ApiOperation({ summary: 'Get google analytics by pages' })
  @Get('pages')
  async getByPages(@Query() dto: GetPagesDto) {
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

  // @ApiOperation({ summary: 'Get google analytics by page' })
  // @Get('analytics/pages/:page(*)')
  // async getByPage(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetByPageQueryDto,
  //   @Param() param: GetByPageParamDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleAnalyticsService.getByPage(
  //       query,
  //       user.user_metadata.client_id,
  //       param.page,
  //     );
  //   const message = 'google analytics page fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }

  // @ApiOperation({ summary: 'Get google analytics overall organic traffic' })
  // @Get('analytics/overall-organic-traffic')
  // async getOverallOrganicTraffic(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetOverallOrganicTrafficQueryDto,
  // ) {
  //   const { analysis, data } =
  //     await this.googleAnalyticsService.getOverallOrganicTraffic(
  //       query,
  //       user.user_metadata.client_id,
  //     );
  //   const message =
  //     'google analytics overall organic traffic data fetched successfully';
  //   return {
  //     message,
  //     analysis,
  //     data,
  //   };
  // }

  // @ApiOperation({ summary: 'Get google analytics daily organic traffic' })
  // @Get('analytics/daily-organic-traffic')
  // async getDailyOrganicTraffic(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetDailyOrganicTrafficQueryDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleAnalyticsService.getDailyOrganicTraffic(
  //       query,
  //       user.user_metadata.client_id,
  //     );
  //   const message =
  //     'google analytics daily organic traffic data fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }
}
