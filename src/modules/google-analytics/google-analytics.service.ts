import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { analyticsdata_v1beta, google } from 'googleapis';
import { GetOverallDto } from './dto/get-overall.dto';
import { formatDate, roundNumber } from 'src/utils/global.utils';
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

@Injectable()
export class GoogleAnalyticsService {
  private readonly logger = new Logger(GoogleAnalyticsService.name);
  private readonly SERVICE_NAME = Platform.GOOGLE_ANALYTICS;

  constructor(
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleAnalyticsRepository: GoogleAnalyticsRepository,
  ) {}

  private async getGoogleAnalytics(clientId: string) {
    const [propertyId, currentOauth2Client] = await Promise.all([
      this.googleAnalyticsRepository.getPropertyId(clientId),
      this.googleOauthService.getOauth2Client(this.SERVICE_NAME, clientId),
    ]);

    if (!propertyId) {
      throw new NotFoundException('google analytics property_id is required');
    }

    const { data: oauth2Client, error } = currentOauth2Client;
    if (error) {
      throw new NotFoundException(error);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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
      this.logger.error(error.message);
      throw new BadRequestException(error.message);
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

  async getAllProperties(clientId: string) {
    const { data: oauth2Client, error } =
      await this.googleOauthService.getOauth2Client(
        this.SERVICE_NAME,
        clientId,
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

  async getCurrentProperty(clientId: string) {
    const [propertyId, currentOauth2Client] = await Promise.all([
      this.googleAnalyticsRepository.getPropertyId(clientId),
      this.googleOauthService.getOauth2Client(this.SERVICE_NAME, clientId),
    ]);

    const { data: oauth2Client, error } = currentOauth2Client;
    if (error) {
      throw new NotFoundException(error);
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
}
