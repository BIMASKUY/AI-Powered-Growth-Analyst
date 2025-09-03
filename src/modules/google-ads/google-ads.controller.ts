/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
// import { AuthGuard } from '../auth/guards/auth.guard';
// import { Auth } from '../common/decorator/auth.decorator';
// import { AuthUser } from '../common/types/types';
import { GetOverallCampaignsDto } from './dto/get-overall-campaigns.dto';
import { GetDailyCampaignsDto } from './dto/get-daily-campaigns.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';

// @ApiBearerAuth()
// @UseGuards(AuthGuard)
@ApiTags('Google Ads')
@Controller('google-ads')
export class GoogleAdsController {
  constructor(private readonly googleAdsService: GoogleAdsService) {}

  @ApiOperation({ summary: 'Get google ads overall campaigns' })
  @Get('overall-campaigns')
  async getOverallCampaigns(
    // @Auth() user: AuthUser,
    @Query() dto: GetOverallCampaignsDto,
  ) {
    const data = await this.googleAdsService.getOverallCampaigns(
      dto,
      'test-client-id',
    );
    const message = 'google ads overall campaigns fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google ads daily campaigns' })
  @Get('daily-campaigns')
  async getDailyCampaigns(
    // @Auth() user: AuthUser,
    @Query() dto: GetDailyCampaignsDto,
  ) {
    const data = await this.googleAdsService.getDailyCampaigns(
      dto,
      'test-client-id',
    );
    const message = 'google ads daily campaigns fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google ads campaigns' })
  @Get('campaigns')
  async getCampaigns(
    // @Auth() user: AuthUser,
    @Query() dto: GetCampaignsDto,
  ) {
    const data = await this.googleAdsService.getCampaigns(
      dto,
      'test-client-id',
    );
    const message = 'google ads campaigns fetched successfully';
    return {
      message,
      data,
    };
  }

  // @ApiOperation({ summary: 'Get google ads campaign by id' })
  // @Get('ads/campaigns/:campaign_id')
  // async getCampaignById(
  //   @Auth() user: AuthUser,
  //   @Query() query: GetCampaignByIdQueryDto,
  //   @Param() param: GetCampaignByIdParamsDto,
  // ) {
  //   const { pagination, analysis, data } =
  //     await this.googleAdsService.getCampaignById(
  //       query,
  //       param.campaign_id,
  //       user.user_metadata.client_id,
  //     );
  //   const message = 'google ads campaign by id fetched successfully';
  //   return {
  //     message,
  //     pagination,
  //     analysis,
  //     data,
  //   };
  // }
}
