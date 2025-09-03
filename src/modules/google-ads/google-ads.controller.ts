/* eslint-disable @typescript-eslint/no-unused-vars */
import { Controller, Get, UseGuards, Query, Param } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
// import { AuthGuard } from '../auth/guards/auth.guard';
// import { Auth } from '../common/decorator/auth.decorator';
// import { AuthUser } from '../common/types/types';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { GetCampaignByIdDto } from './dto/get-campaign-by-id.dto';

// @ApiBearerAuth()
// @UseGuards(AuthGuard)
@ApiTags('Google Ads')
@Controller('google-ads')
export class GoogleAdsController {
  constructor(private readonly googleAdsService: GoogleAdsService) {}

  @ApiOperation({ summary: 'Get google ads overall' })
  @Get('overall')
  async getOverall(
    // @Auth() user: AuthUser,
    @Query() dto: GetOverallDto,
  ) {
    const data = await this.googleAdsService.getOverall(dto, 'test-client-id');
    const message = 'google ads overall fetched successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get google ads daily' })
  @Get('daily')
  async getDaily(
    // @Auth() user: AuthUser,
    @Query() dto: GetDailyDto,
  ) {
    const data = await this.googleAdsService.getDaily(dto, 'test-client-id');
    const message = 'google ads daily fetched successfully';
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

  @ApiOperation({ summary: 'Get google ads campaign by id' })
  @Get('campaigns/:campaign_id')
  async getCampaignById(
    // @Auth() user: AuthUser,
    @Query() dto: GetCampaignByIdDto,
    @Param('campaign_id') campaign_id: string,
  ) {
    const data = await this.googleAdsService.getCampaignById(
      dto,
      campaign_id,
      'test-client-id',
    );
    const message = 'google ads campaign by id fetched successfully';
    return {
      message,
      data,
    };
  }
}
