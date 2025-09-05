/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable, HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAdsApi, enums, Customer, services } from 'google-ads-api';
import { roundNumber } from 'src/utils/global.utils';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetCampaignsDto } from './dto/get-campaigns.dto';
import { GetCampaignByIdDto } from './dto/get-campaign-by-id.dto';

@Injectable()
export class GoogleAdsService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly customerAccountId: string;
  private readonly managerAccountDeveloperToken: string;
  private readonly testingRefreshToken: string;

  constructor(
    // private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    this.clientId = this.configService.getOrThrow('GOOGLE_CLIENT_ID');
    this.clientSecret = this.configService.getOrThrow('GOOGLE_CLIENT_SECRET');

    this.customerAccountId = this.configService.getOrThrow(
      'TESTING_ADS_CUSTOMER_ACCOUNT_ID',
    );
    this.managerAccountDeveloperToken = this.configService.getOrThrow(
      'TESTING_ADS_MANAGER_ACCOUNT_DEVELOPER_TOKEN',
    );
    this.testingRefreshToken = this.configService.getOrThrow(
      'TESTING_REFRESH_TOKEN',
    );
  }

  private async getRefreshToken(clientId: string) {
    // const { data: googleOauth, error: googleOauthError } =
    //   await this.supabaseService
    //     .getClient()
    //     .from('google_oauth')
    //     .select('refresh_token, scope')
    //     .eq('client_id', clientId)
    //     .maybeSingle();

    // const { refresh_token, scope } = googleOauth || {};

    // if (!refresh_token || !scope) {
    //   throw new HttpException('Google OAuth is required', 404);
    // }

    // if (googleOauthError) {
    //   Logger.error(
    //     'failed to get google oauth',
    //     googleOauthError.message,
    //     'GoogleAdsService',
    //   );
    //   throw new HttpException('failed to get google oauth', 500);
    // }

    // const scopeArray = scope.trim().split(' ');
    // const isGoogleAdsScope = scopeArray.includes(
    //   'https://www.googleapis.com/auth/adwords',
    // );
    // if (!isGoogleAdsScope) {
    //   throw new HttpException(
    //     'google ads scope is required on google oauth',
    //     400,
    //   );
    // }

    const refresh_token = this.testingRefreshToken;

    return refresh_token;
  }

  private async getGoogleAdsClient(clientId: string): Promise<{
    googleAdsClient: GoogleAdsApi;
    customer_account_id: string;
  }> {
    // const { data: googleAds, error: googleAdsError } =
    //   await this.supabaseService
    //     .getClient()
    //     .from('google_ads')
    //     .select('customer_account_id, manager_account_developer_token')
    //     .eq('client_id', clientId)
    //     .maybeSingle();

    // const { customer_account_id, manager_account_developer_token } =
    //   googleAds || {};

    // if (!customer_account_id || !manager_account_developer_token) {
    //   throw new HttpException(
    //     'google ads customer_account_id and manager_account_developer_token are required',
    //     404,
    //   );
    // }

    // if (googleAdsError) {
    //   Logger.error(
    //     'error fetch google ads',
    //     googleAdsError.message,
    //     'GoogleAdsService',
    //   );
    //   throw new HttpException('failed to get google ads', 500);
    // }

    // testing purpose
    const customer_account_id = this.customerAccountId;
    const manager_account_developer_token = this.managerAccountDeveloperToken;

    const googleAdsClient = new GoogleAdsApi({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      developer_token: manager_account_developer_token,
    });

    return {
      googleAdsClient,
      customer_account_id,
    };
  }

  private async getCustomer(clientId: string) {
    const [{ googleAdsClient, customer_account_id: customerId }, refreshToken] =
      await Promise.all([
        this.getGoogleAdsClient(clientId),
        this.getRefreshToken(clientId),
      ]);

    const customer: Customer = googleAdsClient.Customer({
      customer_id: customerId,
      refresh_token: refreshToken,
    });

    return customer;
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
  ) {
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
    const spendFieldName = `spend_${currencyCode}`;

    return {
      impressions: campaigns.metrics.impressions,
      [spendFieldName]: roundedSpend,
      conversion_rate_percent: conversionRatePercent,
      ctr_percent: ctrPercent,
      roi_percent: roiPercent,
    };
  }

  private async getCurrencyCode(customer: Customer) {
    const customerInfo = await customer.query(`
      SELECT customer.currency_code
      FROM customer
      LIMIT 1
    `);

    const rawCurrencyCode = customerInfo[0]?.customer?.currency_code;
    const currencyCode = rawCurrencyCode?.toLowerCase() || 'usd';
    return currencyCode;
  }

  async getOverall(dto: GetOverallDto, clientId: string) {
    const customer = await this.getCustomer(clientId);

    const campaigns = await this.fetchGetOverall(
      customer,
      dto.start_date,
      dto.end_date,
    );

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaigns = this.formatGetOverall(campaigns, currencyCode);
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
  ) {
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

      const spendFieldName = `spend_${currencyCode}`;

      return {
        date: campaign.segments.date,
        impressions: campaign.metrics.impressions,
        [spendFieldName]: roundedSpend,
        conversion_rate_percent: conversionRatePercent,
        ctr_percent: ctrPercent,
        roi_percent: roiPercent,
      };
    });

    return formattedCampaigns;
  }

  async getDaily(dto: GetDailyDto, clientId: string) {
    const customer = await this.getCustomer(clientId);

    const campaigns = await this.fetchGetDaily(
      customer,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = campaigns?.length > 0;
    if (!hasData) return [] as string[];

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaigns = this.formatGetDaily(campaigns, currencyCode);
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
  ) {
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

        const spendFieldName = `spend_${currencyCode}`;

        return {
          id,
          name: campaign.campaign.name,
          status,
          impressions: campaign.metrics.impressions,
          [spendFieldName]: roundedSpend,
          conversion_rate_percent: conversionRatePercent,
          ctr_percent: ctrPercent,
          roi_percent: roiPercent,
        };
      })
      .sort((a, b) => b.roi_percent - a.roi_percent);

    return formattedCampaigns;
  }

  async getCampaigns(dto: GetCampaignsDto, clientId: string) {
    const customer = await this.getCustomer(clientId);

    const campaigns = await this.fetchGetCampaigns(
      customer,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = campaigns?.length > 0;
    if (!hasData) return [] as string[];

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaigns = this.formatGetCampaigns(campaigns, currencyCode);
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
  ) {
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

      const spendFieldName = `spend_${currencyCode}`;

      return {
        date: campaign.segments.date,
        impressions: campaign.metrics.impressions,
        [spendFieldName]: roundedSpend,
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
    clientId: string,
  ) {
    const customer = await this.getCustomer(clientId);

    const campaign = await this.fetchGetCampaignById(
      customer,
      dto.start_date,
      dto.end_date,
      campaignId,
    );

    // Case when data not found
    const hasData = campaign?.length > 0;
    if (!hasData) return [] as string[];

    const currencyCode = await this.getCurrencyCode(customer);

    const formattedCampaign = this.formatGetCampaignById(
      campaign,
      currencyCode,
    );
    return formattedCampaign;
  }
}
