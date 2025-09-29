import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { analyticsdata_v1beta, google } from 'googleapis';
import { GetOverallDto } from './dto/get-overall.dto';
import { formatDate, getToday, roundNumber } from 'src/global/global.utils';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetPagesDto } from './dto/get-pages.dto';
import { GetByPageDto } from './dto/get-by-page.dto';
import { GetCountriesDto } from './dto/get-countries.dto';
import { GetByCountryDto } from './dto/get-by-country.dto';
import { GetOverallOrganicDto } from './dto/get-overall-organic.dto';
import { GetDailyOrganicDto } from './dto/get-daily-organic.dto';
import { GoogleOauthService } from '../google-oauth/google-oauth.service';
import { Platform } from '../google-oauth/google-oauth.enum';
import { GoogleAnalyticsRepository } from './google-analytics.repository';
import { RedisService } from '../redis/redis.service';
import { Method } from './google-analytics.enum';
import { BaseMetrics, CountryMetrics, DailyMetrics, PageMetrics } from './google-analytics.type';
import { AdvancedServiceKey, ServiceKey } from '../redis/redis.type';

@Injectable()
export class GoogleAnalyticsService {
  private readonly logger = new Logger(GoogleAnalyticsService.name);
  private readonly SERVICE_NAME = Platform.GOOGLE_ANALYTICS;

  constructor(
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleAnalyticsRepository: GoogleAnalyticsRepository,
    private readonly redisService: RedisService,
  ) {}

  private async getGoogleAnalytics(userId: string) {
    const [propertyId, currentOauth2Client] = await Promise.all([
      this.googleAnalyticsRepository.getPropertyId(userId),
      this.googleOauthService.getOauth2Client(this.SERVICE_NAME, userId),
    ]);

    const { data: oauth2Client, error } = currentOauth2Client;
    if (error) {
      throw new NotFoundException(error);
    }

    if (!propertyId) {
      throw new NotFoundException('google analytics property_id is required');
    }

    const analytics: analyticsdata_v1beta.Analyticsdata = google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client,
    });

    return {
      propertyId,
      analytics,
    };
  }

  private getKeyCache(
    dto: GetOverallDto,
    method: Method,
    userId: string,
  ): ServiceKey {
    return {
      user_id: userId,
      service: this.SERVICE_NAME,
      method: method,
      start_date: dto.start_date,
      end_date: dto.end_date,
    };
  }

  private getAdvancedKeyCache(
    dto: GetPagesDto,
    method: Method,
    userId: string,
  ): AdvancedServiceKey {
    return {
      user_id: userId,
      service: this.SERVICE_NAME,
      method: method,
      start_date: dto.start_date,
      end_date: dto.end_date,
      limit: dto.limit,
      search: dto.search,
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetOverall(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): BaseMetrics {
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

  // overall traffic include organic traffic and paid ads traffic
  async getOverall(dto: GetOverallDto, userId: string): Promise<BaseMetrics> {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_OVERALL, userId);
    const cache = await this.redisService.getService<BaseMetrics>(keyCache);
    if (cache) return cache;

    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);
    const rawData = await this.fetchGetOverall(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return {} as BaseMetrics;

    const formattedData = this.formatGetOverall(rawData);

    // create cache
    await this.redisService.createService<BaseMetrics>(keyCache, formattedData);

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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetDaily(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): DailyMetrics[] {
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

  async getDaily(dto: GetDailyDto, userId: string): Promise<DailyMetrics[]> {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_DAILY, userId);
    const cache = await this.redisService.getService<DailyMetrics[]>(keyCache);
    if (cache) return cache;

    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetDaily(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as DailyMetrics[];

    const formattedData = this.formatGetDaily(rawData);

    // create cache
    await this.redisService.createService<DailyMetrics[]>(
      keyCache,
      formattedData,
    );

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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetCountries(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): CountryMetrics[] {
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

  async getCountries(dto: GetCountriesDto, userId: string): Promise<CountryMetrics[]> {
    // get cache
    const keyCache = this.getAdvancedKeyCache(dto, Method.GET_COUNTRIES, userId);
    const cache = await this.redisService.getAdvancedService<CountryMetrics[]>(keyCache);
    if (cache) return cache;

    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetCountries(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as CountryMetrics[];

    const formattedData = this.formatGetCountries(rawData);

    // create cache
    await this.redisService.createAdvancedService<CountryMetrics[]>(
      keyCache,
      formattedData,
    );

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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetByCountry(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): DailyMetrics[] {
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

  async getByCountry(dto: GetByCountryDto, country: string, userId: string): Promise<DailyMetrics[]> {
    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetByCountry(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      country,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as DailyMetrics[];

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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetPages(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): PageMetrics[] {
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

  async getPages(dto: GetPagesDto, userId: string): Promise<PageMetrics[]> {
    // get cache
    const keyCache = this.getAdvancedKeyCache(dto, Method.GET_PAGES, userId);
    const cache =
      await this.redisService.getAdvancedService<PageMetrics[]>(keyCache);
    if (cache) return cache;

    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetPages(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as PageMetrics[];

    const formattedData = this.formatGetPages(rawData);

    // create cache
    await this.redisService.createAdvancedService<PageMetrics[]>(
      keyCache,
      formattedData,
    );
    
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetByPage(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): DailyMetrics[] {
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

  async getByPage(dto: GetByPageDto, page: string, userId: string): Promise<DailyMetrics[]> {
    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetByPage(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      page,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as DailyMetrics[];

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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetOverallOrganic(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): BaseMetrics {
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

  // organic traffic refers to the visitors who arrive at a website through unpaid search results
  async getOverallOrganic(dto: GetOverallOrganicDto, userId: string): Promise<BaseMetrics> {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_OVERALL_ORGANIC, userId);
    const cache = await this.redisService.getService<BaseMetrics>(keyCache);
    if (cache) return cache;
    
    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetOverallOrganic(
      analytics,
      propertyId,
      dto.end_date,
      dto.end_date,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return {} as BaseMetrics;

    const formattedData = this.formatGetOverallOrganic(rawData);

    // create cache
    await this.redisService.createService<BaseMetrics>(keyCache, formattedData);
    
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
    }
  }

  private formatGetDailyOrganic(
    rawData: analyticsdata_v1beta.Schema$RunReportResponse,
  ): DailyMetrics[] {
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

  async getDailyOrganic(dto: GetDailyOrganicDto, userId: string): Promise<DailyMetrics[]> {
    // get cache
    const keyCache = this.getKeyCache(dto, Method.GET_DAILY_ORGANIC, userId);
    const cache = await this.redisService.getService<DailyMetrics[]>(keyCache);
    if (cache) return cache;
    
    const { propertyId, analytics } = await this.getGoogleAnalytics(userId);

    const rawData = await this.fetchGetDailyOrganic(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // case when data not found
    const hasData = rawData?.rowCount > 0;
    if (!hasData) return [] as DailyMetrics[];

    const formattedData = this.formatGetDailyOrganic(rawData);

    // create cache
    await this.redisService.createService<DailyMetrics[]>(
      keyCache,
      formattedData,
    );

    return formattedData;
  }

  async getAllProperties(userId: string) {
    const { data: oauth2Client, error } =
      await this.googleOauthService.getOauth2Client(
        this.SERVICE_NAME,
        userId,
      );
    if (error) {
      throw new NotFoundException(error);
    }

    const analytics = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    });

    const rawAccount = await analytics.accounts.list();
    const account = rawAccount.data?.accounts?.[0];
    if (!account) return [] as { property_id: string; property_name: string }[];

    const propertiesResponse = await analytics.properties.list({
      filter: `parent:${account.name}`,
    });

    const properties = propertiesResponse.data?.properties;
    if (!properties)
      return [] as { property_id: string; property_name: string }[];

    const formattedProperties = properties.map((property) => {
      const propertyId = property.name.split('/').pop();
      const propertyName = property.displayName;

      return {
        property_id: propertyId,
        property_name: propertyName,
      };
    });

    return formattedProperties;
  }

  async getCurrentProperty(userId: string) {
    const [propertyId, currentOauth2Client] = await Promise.all([
      this.googleAnalyticsRepository.getPropertyId(userId),
      this.googleOauthService.getOauth2Client(this.SERVICE_NAME, userId),
    ]);

    const { data: oauth2Client, error } = currentOauth2Client;
    if (error) {
      throw new NotFoundException(error);
    }

    if (!propertyId) {
      return {
        property_id: '',
        property_name: '',
      };
    }

    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client,
    });

    const { data: property } = await analyticsAdmin.properties.get({
      name: `properties/${propertyId}`,
    });

    return {
      property_id: propertyId,
      property_name: property.displayName,
    };
  }

  async isConnected(userId: string) {
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
