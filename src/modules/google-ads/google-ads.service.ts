import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAdsApi, enums, Customer, services } from 'google-ads-api';
import { getToday, roundNumber } from 'src/global/global.utils';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { GetCampaignByIdDto } from './dto/get-campaign-by-id.dto';
import { GoogleOauthService } from '../google-oauth/google-oauth.service';
import { Platform } from '../google-oauth/google-oauth.enum';
import { GoogleAdsRepository } from './google-ads.repository';
import { RedisService } from '../redis/redis.service';
import { BaseMetrics, CampaignMetrics, DailyMetrics } from './google-ads.type';
import { ServiceKey } from '../redis/redis.type';
import { Method } from './google-ads.enum';

@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);
  private readonly SERVICE_NAME = Platform.GOOGLE_ADS;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleAdsRepository: GoogleAdsRepository,
    private readonly redisService: RedisService,
  ) {
    this.clientId = this.configService.getOrThrow('GOOGLE_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow('GOOGLE_CLIENT_SECRET');
  }

  private async getGoogleAdsClient(userId: string): Promise<GoogleAdsApi> {
    const account = await this.googleAdsRepository.getAccount(userId);
    const { manager_account_developer_token } = account || {};
    if (!manager_account_developer_token) {
      throw new NotFoundException(
        'manager account developer token is required',
      );
    }

    const googleAdsClient = new GoogleAdsApi({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      developer_token: manager_account_developer_token,
    });

    return googleAdsClient;
  }

  private async getCustomer(userId: string): Promise<Customer> {
    const [googleAdsClient, account, currentOauth2Client] = await Promise.all([
      this.getGoogleAdsClient(userId),
      this.googleAdsRepository.getAccount(userId),
      this.googleOauthService.getOauth2Client(this.SERVICE_NAME, userId),
    ]);

    const { data: oauth2Client, error } = currentOauth2Client;
    if (error) {
      this.logger.error(error);
      throw new NotFoundException(error);
    }

    const customer: Customer = googleAdsClient.Customer({
      customer_id: account.customer_account_id,
      refresh_token: oauth2Client.credentials.refresh_token,
    });

    return customer;
  }

  private async getCurrencyCode(customer: Customer): Promise<string> {
    const customerInfo = await customer.query(`
      SELECT customer.currency_code
      FROM customer
      LIMIT 1
    `);

    const rawCurrencyCode = customerInfo[0]?.customer?.currency_code;
    const currencyCode = rawCurrencyCode?.toLowerCase() || 'usd';
    return currencyCode;
  }

  private getKeyCache(
    dto: GetOverallDto,
    method: Method,
    userId: string,
  ): ServiceKey {
    return {
      user_id: userId,
      service: Platform.GOOGLE_ADS,
      method: method,
      start_date: dto.start_date,
      end_date: dto.end_date,
    };
  }

  private async fetchGetOverall(
    customer: Customer,
    startDate: string,
    endDate: string,
  ) {
    const campaigns = await customer.report({
      entity: 'customer',
      metrics: [
        'metrics.clicks',
        'metrics.impressions',
        'metrics.cost_micros',
        'metrics.conversions',
        'metrics.conversions_value',
        'metrics.ctr',
      ],
      from_date: startDate,
      to_date: endDate,
    });

    return campaigns[0];
  }

  private formatGetOverall(
    campaigns: services.IGoogleAdsRow,
    currencyCode: string,
  ): BaseMetrics {
    const spend = campaigns.metrics.cost_micros / 1000000;
    const roundedSpend = roundNumber<number>(spend);
    const conversionValue = campaigns.metrics.conversions_value;
    const conversions = campaigns.metrics.conversions;
    const clicks = campaigns.metrics.clicks;
    const roi = spend > 0 ? (conversionValue - spend) / spend : 0;
    const roiPercent = roundNumber<number>(roi * 100);
    const conversionRates = clicks > 0 ? conversions / clicks : 0;
    const conversionRatePercent = roundNumber<number>(conversionRates * 100);
    const ctrPercent = campaigns.metrics.ctr
      ? roundNumber<number>(campaigns.metrics.ctr * 100)
      : campaigns.metrics.ctr;

    return {
      impressions: campaigns.metrics.impressions,
      currency: currencyCode,
      spend: roundedSpend,
      conversion_rate_percent: conversionRatePercent,
      ctr_percent: ctrPercent,
      roi_percent: roiPercent,
    };
  }

  async getOverall(dto: GetOverallDto, userId: string): Promise<BaseMetrics> {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_OVERALL, userId);
    const cache = await this.redisService.getService<BaseMetrics>(keyCache);
    if (cache) return cache;

    const customer = await this.getCustomer(userId);

    const campaigns = await this.fetchGetOverall(
      customer,
      dto.start_date,
      dto.end_date,
    );

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaigns = this.formatGetOverall(campaigns, currencyCode);

    // create cache
    await this.redisService.createService<BaseMetrics>(
      keyCache,
      formattedCampaigns,
    );

    return formattedCampaigns;
  }

  private async fetchGetDaily(
    customer: Customer,
    startDate: string,
    endDate: string,
  ) {
    const campaigns = await customer.report({
      entity: 'customer',
      metrics: [
        'metrics.clicks',
        'metrics.impressions',
        'metrics.cost_micros',
        'metrics.conversions',
        'metrics.conversions_value',
        'metrics.ctr',
      ],
      segments: ['segments.date'],
      order: [
        {
          field: 'segments.date',
          sort_order: 'ASC',
        },
      ],
      from_date: startDate,
      to_date: endDate,
    });

    return campaigns;
  }

  private formatGetDaily(
    campaigns: services.IGoogleAdsRow[],
    currencyCode: string,
  ): DailyMetrics[] {
    const formattedCampaigns = campaigns.map((campaign) => {
      const spend = campaign.metrics.cost_micros / 1000000;
      const roundedSpend = roundNumber<number>(spend);
      const conversionValue = campaign.metrics.conversions_value;
      const conversions = campaign.metrics.conversions;
      const clicks = campaign.metrics.clicks;
      const roi = spend > 0 ? (conversionValue - spend) / spend : 0;
      const roiPercent = roundNumber<number>(roi * 100);
      const conversionRates = clicks > 0 ? conversions / clicks : 0;
      const conversionRatePercent = roundNumber<number>(conversionRates * 100);
      const ctrPercent = campaign.metrics.ctr
        ? roundNumber<number>(campaign.metrics.ctr * 100)
        : campaign.metrics.ctr;

      return {
        date: campaign.segments.date,
        impressions: campaign.metrics.impressions,
        currency: currencyCode,
        spend: roundedSpend,
        conversion_rate_percent: conversionRatePercent,
        ctr_percent: ctrPercent,
        roi_percent: roiPercent,
      };
    });

    return formattedCampaigns;
  }

  async getDaily(dto: GetDailyDto, userId: string): Promise<DailyMetrics[]> {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_DAILY, userId);
    const cache = await this.redisService.getService<DailyMetrics[]>(keyCache);
    if (cache) return cache;

    const customer = await this.getCustomer(userId);

    const campaigns = await this.fetchGetDaily(
      customer,
      dto.start_date,
      dto.end_date,
    );

    // case when data not found
    const hasData = campaigns?.length > 0;
    if (!hasData) return [] as DailyMetrics[];

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaigns = this.formatGetDaily(campaigns, currencyCode);

    // create cache
    await this.redisService.createService<DailyMetrics[]>(
      keyCache,
      formattedCampaigns,
    );

    return formattedCampaigns;
  }

  private async fetchGetCampaigns(
    customer: Customer,
    startDate: string,
    endDate: string,
  ) {
    const campaigns = await customer.query(`
      SELECT
        campaign.name,
        campaign.status,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr
      FROM campaign
      WHERE campaign.status IN ('ENABLED', 'PAUSED')
        AND metrics.impressions > 0
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.impressions DESC
    `);

    return campaigns;
  }

  private formatGetCampaigns(
    campaigns: services.IGoogleAdsRow[],
    currencyCode: string,
  ): CampaignMetrics[] {
    const formattedCampaigns = campaigns
      .map((campaign) => {
        const id = campaign.campaign.resource_name.split('/')[3];
        const status = enums.CampaignStatus[campaign.campaign.status];
        const spend = campaign.metrics.cost_micros / 1000000;
        const conversionValue = campaign.metrics.conversions_value;
        const conversions = campaign.metrics.conversions;
        const clicks = campaign.metrics.clicks;

        const roi = spend > 0 ? (conversionValue - spend) / spend : 0;
        const roiPercent = roundNumber<number>(roi * 100);
        const conversionRates = clicks > 0 ? conversions / clicks : 0;
        const conversionRatePercent = roundNumber<number>(
          conversionRates * 100,
        );

        const roundedSpend = roundNumber<number>(spend);
        const ctrPercent = campaign.metrics.ctr
          ? roundNumber<number>(campaign.metrics.ctr * 100)
          : campaign.metrics.ctr;

        return {
          id,
          name: campaign.campaign.name,
          status: status as keyof typeof enums.CampaignStatus,
          impressions: campaign.metrics.impressions,
          currency: currencyCode,
          spend: roundedSpend,
          conversion_rate_percent: conversionRatePercent,
          ctr_percent: ctrPercent,
          roi_percent: roiPercent,
        };
      })
      .sort((a, b) => b.roi_percent - a.roi_percent);

    return formattedCampaigns;
  }

  async getCampaigns(dto: GetCampaignsDto, userId: string) {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_CAMPAIGNS, userId);
    const cache = await this.redisService.getService<CampaignMetrics>(keyCache);
    if (cache) return cache;

    const customer = await this.getCustomer(userId);

    const campaigns = await this.fetchGetCampaigns(
      customer,
      dto.start_date,
      dto.end_date,
    );

    // case when data not found
    const hasData = campaigns?.length > 0;
    if (!hasData) return [] as CampaignMetrics[];

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaigns = this.formatGetCampaigns(campaigns, currencyCode);

    // create cache
    await this.redisService.createService<CampaignMetrics[]>(
      keyCache,
      formattedCampaigns,
    );

    return formattedCampaigns;
  }

  private async fetchGetCampaignById(
    customer: Customer,
    startDate: string,
    endDate: string,
    campaignId: string,
  ) {
    const campaign = await customer.query(`
      SELECT
        campaign.name,
        campaign.status,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        segments.date
      FROM campaign
      WHERE campaign.id = ${campaignId}
        AND campaign.status IN ('ENABLED', 'PAUSED')
        AND segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY segments.date ASC
    `);

    return campaign;
  }

  private formatGetCampaignById(
    campaigns: services.IGoogleAdsRow[],
    currencyCode: string,
  ): DailyMetrics[] {
    const formattedCampaign = campaigns.map((campaign) => {
      const spend = campaign.metrics.cost_micros / 1000000;
      const roundedSpend = roundNumber<number>(spend);
      const conversionValue = campaign.metrics.conversions_value;
      const conversions = campaign.metrics.conversions;
      const clicks = campaign.metrics.clicks;
      const roi = spend > 0 ? (conversionValue - spend) / spend : 0;
      const roiPercent = roundNumber<number>(roi * 100);
      const conversionRates = clicks > 0 ? conversions / clicks : 0;
      const conversionRatePercent = roundNumber<number>(conversionRates * 100);
      const ctrPercent = campaign.metrics.ctr
        ? roundNumber<number>(campaign.metrics.ctr * 100)
        : campaign.metrics.ctr;

      return {
        date: campaign.segments.date,
        impressions: campaign.metrics.impressions,
        currency: currencyCode,
        spend: roundedSpend,
        conversion_rate_percent: conversionRatePercent,
        ctr_percent: ctrPercent,
        roi_percent: roiPercent,
      };
    });

    return formattedCampaign;
  }

  async getCampaignById(
    dto: GetCampaignByIdDto,
    campaignId: string,
    userId: string,
  ): Promise<DailyMetrics[]> {
    const customer = await this.getCustomer(userId);

    const campaign = await this.fetchGetCampaignById(
      customer,
      dto.start_date,
      dto.end_date,
      campaignId,
    );

    // Case when data not found
    const hasData = campaign?.length > 0;
    if (!hasData) return [] as DailyMetrics[];

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaign = this.formatGetCampaignById(
      campaign,
      currencyCode,
    );
    return formattedCampaign;
  }

  async getAllAccountIds(userId: string): Promise<string[]> {
    const googleAdsClient = await this.getGoogleAdsClient(userId);
    const googleOauth = await this.googleOauthService.getOauth2Client(
      this.SERVICE_NAME,
      userId,
    );

    const { data: oauth2Client, error } = googleOauth;
    if (error) return [] as string[];

    const customerIds = await googleAdsClient.listAccessibleCustomers(
      oauth2Client.credentials.refresh_token,
    );
    return customerIds.resource_names.map((name: string) => name.split('/')[1]);
  }

  async isConnected(userId: string): Promise<boolean> {
    try {
      const today = getToday();
      await this.getOverall(
        {
          start_date: today,
          end_date: today,
        },
        userId,
      );

      return true;
    } catch (error) {
      this.logger.error(error);
      return false;
    }
  }
}
