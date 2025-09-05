/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, HttpException, Logger } from '@nestjs/common';
import { analyticsdata_v1beta, google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GetOverallDto } from './dto/get-overall.dto';
import { formatDate, roundNumber } from 'src/utils/global.utils';
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetPagesDto } from './dto/get-pages.dto';
import { GetByPageDto } from './dto/get-by-page.dto';
import { GetCountriesDto } from './dto/get-countries.dto';
import { GetByCountryDto } from './dto/get-by-country.dto';
import { GetOverallOrganicDto } from './dto/get-overall-organic.dto';
import { GetDailyOrganicDto } from './dto/get-daily-organic.dto';

@Injectable()
export class GoogleAnalyticsService {
  private readonly oauth2ClientSchema: OAuth2ClientOptions;
  private readonly logger = new Logger(GoogleAnalyticsService.name);
  private readonly STATIC_OAUTH2_CLIENT_FOR_TESTING: any;
  private readonly TESTING_GA_PROPERTY_ID: string;
  // private readonly SERVICE_NAME = 'google-analytics';

  constructor(private readonly configService: ConfigService) {
    const env = this.configService.getOrThrow('ENV');
    const redirectUri =
      env === 'dev'
        ? this.configService.getOrThrow('GOOGLE_REDIRECT_URI_FE_DEV')
        : this.configService.getOrThrow('GOOGLE_REDIRECT_URI_FE_PROD');

    this.oauth2ClientSchema = {
      clientId: this.configService.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
      redirectUri,
    };

    this.STATIC_OAUTH2_CLIENT_FOR_TESTING = {
      access_token: this.configService.getOrThrow('TESTING_ACCESS_TOKEN'),
      refresh_token: this.configService.getOrThrow('TESTING_REFRESH_TOKEN'),
      expiry_date: this.configService.getOrThrow('TESTING_EXPIRY_DATE'),
      scope: this.configService.getOrThrow('TESTING_SCOPE'),
    };

    this.TESTING_GA_PROPERTY_ID = this.configService.getOrThrow(
      'TESTING_GA_PROPERTY_ID',
    );
  }

  private async getOauth2Client(clientId: string) {
    // const { data: googleOauth, error } = await this.supabaseService
    // .getClient()
    // .from('google_oauth')
    // .select('access_token, refresh_token, expiry_date, scope')
    // .eq('client_id', clientId)
    // .maybeSingle();

    const googleOauth = this.STATIC_OAUTH2_CLIENT_FOR_TESTING;

    const { access_token, refresh_token, expiry_date, scope } =
      googleOauth || {};

    if (!access_token || !refresh_token || !expiry_date || !scope) {
      throw new HttpException('Google OAuth is required', 404);
    }

    const scopeArray = scope.trim().split(' ');
    const isGoogleAnalyticsScope = scopeArray.includes(
      'https://www.googleapis.com/auth/analytics.readonly',
    );
    if (!isGoogleAnalyticsScope) {
      throw new HttpException(
        'google analytics scope is required on google oauth',
        400,
      );
    }

    const oauth2Client = new OAuth2Client(this.oauth2ClientSchema);

    oauth2Client.setCredentials({
      access_token,
      refresh_token,
      expiry_date,
    });

    return oauth2Client;
  }

  private async getPropertyId(clientId: string) {
    // const { data: googleAnalytics, error } = await this.supabaseService
    //   .getClient()
    //   .from('google_analytics')
    //   .select('property_id')
    //   .eq('client_id', clientId)
    //   .maybeSingle();

    // const { property_id } = googleAnalytics || {};

    // if (!property_id)
    //   throw new HttpException('google analytics property_id is required', 404);

    // if (error) {
    //   this.error(
    //     error.message,
    //     'GoogleAnalyticsService',
    //   );
    //   throw new HttpException('google analytics error', 500);
    // }

    const property_id = this.TESTING_GA_PROPERTY_ID;

    return property_id;
  }

  private async getGoogleAnalytics(clientId: string) {
    const [propertyId, oauth2Client] = await Promise.all([
      this.getPropertyId(clientId),
      this.getOauth2Client(clientId),
    ]);

    const analytics: analyticsdata_v1beta.Analyticsdata = google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client,
    });

    return {
      propertyId,
      analytics,
    };
  }

  private async fetchGetOverall(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
        },
      });
      return data;
    } catch (error) {
      this.logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 400);
    }
  }

  private formatGetOverall(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const metricValues = rawData.rows[0].metricValues;
    const bounceRate = Number(metricValues[2].value);
    const bounceRatePercent = roundNumber<number>(bounceRate * 100);

    return {
      sessions: Number(metricValues[0].value),
      screen_page_views: Number(metricValues[1].value),
      bounce_rate_percent: bounceRatePercent,
      average_session_duration_seconds: roundNumber<string>(
        metricValues[3].value,
      ),
      active_users: Number(metricValues[4].value),
    };
  }

  // all include organic traffic
  async getOverall(dto: GetOverallDto, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetOverall(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return {};

    const formattedData = this.formatGetOverall(rawData);

    return formattedData;
  }

  private async fetchGetDaily(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'date' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          orderBys: [
            {
              dimension: { dimensionName: 'date' },
            },
          ],
        },
      });
      return data;
    } catch (error) {
      this.logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetDaily(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows.map((row) => {
      const rawDate = row.dimensionValues[0].value;
      const formattedDate = formatDate(rawDate);
      const bounceRate = Number(row.metricValues[2].value);
      const bounceRatePercent = roundNumber<number>(bounceRate * 100);

      return {
        date: formattedDate,
        sessions: Number(row.metricValues[0].value),
        screen_page_views: Number(row.metricValues[1].value),
        bounce_rate_percent: bounceRatePercent,
        average_session_duration_seconds: roundNumber<string>(
          row.metricValues[3].value,
        ),
        active_users: Number(row.metricValues[4].value),
      };
    });

    return formattedData;
  }

  async getDaily(dto: GetDailyDto, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetDaily(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetDaily(rawData);

    return formattedData;
  }

  private async fetchGetCountries(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
    limit: number,
    search: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'country' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          orderBys: [
            {
              metric: { metricName: 'activeUsers' },
              desc: true,
            },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'country',
              stringFilter: {
                matchType: 'CONTAINS',
                value: search,
                caseSensitive: false,
              },
            },
          },
          limit: limit.toString(),
        },
      });

      return data;
    } catch (error) {
      Logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetCountries(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows.map((row) => {
      const bounceRate = Number(row.metricValues[2].value);
      const bounceRatePercent = roundNumber<number>(bounceRate * 100);

      return {
        country: row.dimensionValues[0].value,
        sessions: Number(row.metricValues[0].value),
        screen_page_views: Number(row.metricValues[1].value),
        bounce_rate_percent: bounceRatePercent,
        average_session_duration_seconds: roundNumber<string>(
          row.metricValues[3].value,
        ),
        active_users: Number(row.metricValues[4].value),
      };
    });

    return formattedData;
  }

  async getCountries(dto: GetCountriesDto, clientId: string) {
    // Check cache first (the cache is only for query without search)
    // const cachedData = await this.redisService.get(
    //   clientId,
    //   this.SERVICE_NAME,
    //   'get-by-countries',
    //   query.start_date,
    //   query.end_date,
    //   true,
    //   query.order_by,
    //   query.limit,
    //   query.page,
    // );
    // if (cachedData && !query.search) return cachedData as GetByCountries;

    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetCountries(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetCountries(rawData);

    // Save cache to redis (only for query without search)
    // if (!query.search) {
    //   await this.redisService.add(
    //     {
    //       clientId,
    //       service: this.SERVICE_NAME,
    //       method: 'get-by-countries',
    //       startDate: query.start_date,
    //       endDate: query.end_date,
    //       withAnalysis: true,
    //       orderBy: query.order_by,
    //       limit: query.limit,
    //       page: query.page,
    //     },
    //     {
    //       data: paginationFormattedData,
    //       pagination: paginationInfo,
    //       analysis,
    //     },
    //   );
    // }

    return formattedData;
  }

  private async fetchGetByCountry(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
    country: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'country' }, { name: 'date' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          orderBys: [
            {
              dimension: { dimensionName: 'date' },
              desc: false,
            },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'country',
              stringFilter: {
                value: country,
              },
            },
          },
          // limit: limit.toString(),
          // offset: offset.toString(),
        },
      });

      return data;
    } catch (error) {
      Logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetByCountry(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows.map((row) => {
      const rawDate = row.dimensionValues[1].value;
      const formattedDate = formatDate(rawDate);
      const bounceRate = Number(row.metricValues[2].value);
      const bounceRatePercent = roundNumber<number>(bounceRate * 100);
      return {
        date: formattedDate,
        sessions: Number(row.metricValues[0].value),
        screen_page_views: Number(row.metricValues[1].value),
        bounce_rate_percent: bounceRatePercent,
        average_session_duration_seconds: roundNumber<string>(
          row.metricValues[3].value,
        ),
        active_users: Number(row.metricValues[4].value),
      };
    });

    return formattedData;
  }

  async getByCountry(dto: GetByCountryDto, country: string, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetByCountry(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      country,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetByCountry(rawData);

    return formattedData;
  }

  private async fetchGetPages(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
    limit: number,
    search: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          orderBys: [
            {
              metric: { metricName: 'activeUsers' },
              desc: true,
            },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                matchType: 'CONTAINS',
                value: search,
                caseSensitive: false,
              },
            },
          },
          limit: limit.toString(),
        },
      });

      return data;
    } catch (error) {
      Logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetPages(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows.map((row) => {
      const bounceRate = Number(row.metricValues[2].value);
      const bounceRatePercent = roundNumber<number>(bounceRate * 100);

      return {
        page: row.dimensionValues[0].value,
        title: row.dimensionValues[1].value,
        sessions: Number(row.metricValues[0].value),
        screen_page_views: Number(row.metricValues[1].value),
        bounce_rate_percent: bounceRatePercent,
        average_session_duration_seconds: roundNumber<string>(
          row.metricValues[3].value,
        ),
        active_users: Number(row.metricValues[4].value),
      };
    });

    return formattedData;
  }

  async getPages(dto: GetPagesDto, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetPages(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetPages(rawData);

    return formattedData;
  }

  private async fetchGetByPage(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
    page: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'pagePath' }, { name: 'date' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          orderBys: [
            {
              dimension: { dimensionName: 'date' },
              desc: false,
            },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'pagePath',
              stringFilter: {
                value: page,
              },
            },
          },
        },
      });

      return data;
    } catch (error) {
      Logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetByPage(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows.map((row) => {
      const rawDate = row.dimensionValues[1].value;
      const formattedDate = formatDate(rawDate);
      const bounceRate = Number(row.metricValues[2].value);
      const bounceRatePercent = roundNumber<number>(bounceRate * 100);

      return {
        date: formattedDate,
        sessions: Number(row.metricValues[0].value),
        screen_page_views: Number(row.metricValues[1].value),
        bounce_rate_percent: bounceRatePercent,
        average_session_duration_seconds: roundNumber<string>(
          row.metricValues[3].value,
        ),
        active_users: Number(row.metricValues[4].value),
      };
    });

    return formattedData;
  }

  async getByPage(query: GetByPageDto, page: string, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetByPage(
      analytics,
      propertyId,
      query.start_date,
      query.end_date,
      page,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetByPage(rawData);
    return formattedData;
  }

  private async fetchGetOverallOrganic(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'sessionMedium' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          dimensionFilter: {
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: 'sessionMedium',
                    stringFilter: {
                      matchType: 'EXACT',
                      value: 'organic',
                    },
                  },
                },
              ],
            },
          },
        },
      });

      return data;
    } catch (error) {
      Logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetOverallOrganic(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const metricValues = rawData.rows[0].metricValues;
    const bounceRate = Number(metricValues[2].value);
    const bounceRatePercent = roundNumber<number>(bounceRate * 100);

    return {
      sessions: Number(metricValues[0].value),
      screen_page_views: Number(metricValues[1].value),
      bounce_rate_percent: bounceRatePercent,
      average_session_duration_seconds: roundNumber<string>(
        metricValues[3].value,
      ),
      active_users: Number(metricValues[4].value),
    };
  }

  // Organic traffic refers to the visitors who arrive at a website through unpaid search results
  async getOverallOrganic(dto: GetOverallOrganicDto, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetOverallOrganic(
      analytics,
      propertyId,
      dto.end_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return {};

    const formattedData = this.formatGetOverallOrganic(rawData);
    return formattedData;
  }

  private async fetchGetDailyOrganic(
    analytics: analyticsdata_v1beta.Analyticsdata,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const { data } = await analytics.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dimensions: [{ name: 'date' }, { name: 'sessionMedium' }],
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'activeUsers' },
          ],
          orderBys: [
            {
              dimension: { dimensionName: 'date' },
              desc: false,
            },
          ],
          dimensionFilter: {
            andGroup: {
              expressions: [
                {
                  filter: {
                    fieldName: 'sessionMedium',
                    stringFilter: {
                      matchType: 'EXACT',
                      value: 'organic',
                    },
                  },
                },
              ],
            },
          },
          // limit: limit.toString(),
          // offset: offset.toString(),
        },
      });

      return data;
    } catch (error) {
      Logger.error(error.message, 'GoogleAnalyticsService');
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetDailyOrganic(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows.map((row) => {
      const rawDate = row.dimensionValues[0].value;
      const formattedDate = formatDate(rawDate);
      const bounceRate = Number(row.metricValues[2].value);
      const bounceRatePercent = roundNumber<number>(bounceRate * 100);
      return {
        date: formattedDate,
        sessions: Number(row.metricValues[0].value),
        screen_page_views: Number(row.metricValues[1].value),
        bounce_rate_percent: bounceRatePercent,
        average_session_duration_seconds: roundNumber<string>(
          row.metricValues[3].value,
        ),
        active_users: Number(row.metricValues[4].value),
      };
    });

    return formattedData;
  }

  async getDailyOrganic(query: GetDailyOrganicDto, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const rawData = await this.fetchGetDailyOrganic(
      analytics,
      propertyId,
      query.start_date,
      query.end_date,
    );

    // Case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetDailyOrganic(rawData);
    return formattedData;
  }

  async getAllPropertyIds(clientId: string) {
    const oauth2Client = await this.getOauth2Client(clientId);

    const analytics = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    });

    const rawAccount = await analytics.accounts.list();
    const account = rawAccount.data?.accounts?.[0];
    if (!account) return [] as string[];

    const propertiesResponse = await analytics.properties.list({
      filter: `parent:${account.name}`,
    });

    const properties = propertiesResponse.data?.properties;
    if (!properties) return [] as string[];

    const formattedProperties = properties.map((property) => {
      const propertyId = property.name.split('/').pop();
      const name = property.displayName;

      return {
        property_id: propertyId,
        name,
      };
    });

    return formattedProperties;
  }

  async getCurrentProperty(clientId: string) {
    const propertyId = await this.getPropertyId(clientId);
    const oauth2Client = await this.getOauth2Client(clientId);

    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    });

    const propertyResponse = await analyticsAdmin.properties.get({
      name: `properties/${propertyId}`,
    });

    const property = propertyResponse.data;

    return {
      property_id: propertyId,
      name: property.displayName,
    };
  }
}
