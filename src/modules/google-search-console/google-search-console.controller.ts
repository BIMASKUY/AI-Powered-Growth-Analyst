/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { GoogleSearchConsoleService } from './google-search-console.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
// import { AuthGuard } from '../auth/guards/auth.guard';
// import { Auth } from '../common/decorator/auth.decorator';
// import { AuthUser } from '../common/types/types';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetKeywordsDto } from './dto/get-keywords.dto';

// @ApiBearerAuth()
// @UseGuards(AuthGuard)
@ApiTags('Google Search Console')
@Controller('google-search-console')
export class GoogleSearchConsoleController {
  constructor(
    private readonly googleSearchConsoleService: GoogleSearchConsoleService,
  ) {}

  @ApiOperation({ summary: 'Get google search console overall data' })
  @Get('overall')
  async getOverall(
    // @Auth() user: AuthUser,
    @Query() dto: GetOverallDto,
  ) {
    const data = await this.googleSearchConsoleService.getOverall(
      dto,
      'test-client-id',
    );
    const message = 'google search console overall data fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console daily data' })
  @Get('daily')
  async getDaily(
    // @Auth() user: AuthUser,
    @Query() dto: GetDailyDto,
  ) {
    const data = await this.googleSearchConsoleService.getDaily(
      dto,
      'test-client-id',
    );
    const message = 'google search console daily data fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google search console keywords' })
  @Get('keywords')
  async getKeywords(
    // @Auth() user: AuthUser,
    @Query() dto: GetKeywordsDto,
  ) {
    const data = await this.googleSearchConsoleService.getKeywords(
      dto,
      'test-client-id',
    );
    const message = 'google search console keywords fetched successfully';
    return {
      message,
      data,
    };
  }

  // @ApiOperation({ summary: 'Get google search console by keyword' })
  // @Get('search-console/keywords/:keyword')
  // async getByKeyword(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetByKeywordQueryDto,
  //   @Param() param: GetKeywordParamDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleSearchConsoleService.getByKeyword(
  //       query,
  //       user.user_metadata.client_id,
  //       param.keyword,
  //     );
  //   const message = 'google search console by keyword fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }

  // @ApiOperation({ summary: 'Get google search console countries' })
  // @Get('search-console/countries')
  // async getCountries(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetCountriesQueryDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleSearchConsoleService.getCountries(
  //       query,
  //       user.user_metadata.client_id,
  //     );
  //   const message = 'google search console by countries fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }

  // @ApiOperation({ summary: 'Get google search console by country' })
  // @Get('search-console/countries/:country')
  // async getByCountry(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetByCountryQueryDto,
  //   @Param() param: GetByCountryParamDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleSearchConsoleService.getByCountry(
  //       query,
  //       user.user_metadata.client_id,
  //       param.country,
  //     );
  //   const message = 'google search console by country fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }
}
