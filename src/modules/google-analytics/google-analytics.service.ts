/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, HttpException, Logger } from '@nestjs/common';
import { analyticsdata_v1beta, google } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { GetOverallDto } from './dto/get-overall.dto';
import { roundNumber } from 'src/utils/global.utils';
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import { GetDailyDto } from './dto/get-daily.dto';
import { parse, format } from 'date-fns';
import { GetPagesDto } from './dto/get-pages.dto';

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
    data: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const metricValues = data.rows[0].metricValues;
    const bounceRate = roundNumber<string>(metricValues[2].value);
    const bounceRatePercent = bounceRate * 100;

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

    const overallData = await this.fetchGetOverall(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = overallData?.rowCount > 0;
    if (!hasData) return {};

    const overallFormattedData = this.formatGetOverall(overallData);

    return overallFormattedData;
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
    allData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows: allRowsData } = allData;

    const formattedData = allRowsData.map((row) => {
      const rawDate = row.dimensionValues[0].value;
      const formattedDate = format(
        parse(rawDate, 'yyyyMMdd', new Date()),
        'yyyy-MM-dd',
      );
      const bounceRate = roundNumber<string>(row.metricValues[2].value);
      const bounceRatePercent = bounceRate * 100;

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

    const allData = await this.fetchGetDaily(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const isTotalDataAvailable = allData?.rowCount > 0;
    if (!isTotalDataAvailable) return [] as string[];

    const formattedData = this.formatGetDaily(allData);

    return formattedData;
  }

  // private async fetchGetByCountries(
  //   analytics: analyticsdata_v1beta.Analyticsdata,
  //   propertyId: string,
  //   startDate: string,
  //   endDate: string,
  //   orderBy: boolean,
  //   search: string,
  // ) {
  //   try {
  //     const [allRawDataWithFilter, allRawData] = await Promise.all([
  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'country' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               metric: { metricName: 'sessions' },
  //               desc: orderBy,
  //             },
  //           ],
  //           dimensionFilter: {
  //             filter: {
  //               fieldName: 'country',
  //               stringFilter: {
  //                 matchType: 'CONTAINS',
  //                 value: search,
  //                 caseSensitive: false,
  //               },
  //             },
  //           },
  //           // removed because filters need pagination manually
  //           // limit: limit.toString(),
  //           // offset: offset.toString(),
  //         },
  //       }),

  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'country' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               metric: { metricName: 'sessions' },
  //               desc: true,
  //             },
  //           ],
  //         },
  //       }),
  //     ]);

  //     const { data: allDataWithFilter } = allRawDataWithFilter;
  //     const { data: allData } = allRawData;

  //     return {
  //       allDataWithFilter,
  //       allData,
  //     };
  //   } catch (error) {
  //     Logger.error(error.message, 'GoogleAnalyticsService');
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetByCountries(
  //   allDataWithFilter: analyticsdata_v1beta.Schema$RunReportResponse,
  //   allData: analyticsdata_v1beta.Schema$RunReportResponse,
  //   limit: number,
  //   offset: number,
  // ) {
  //   const { rows: allRowsDataWithFilter } = allDataWithFilter;
  //   const { rows: allRowsData } = allData;

  //   const paginatioRowsData = allRowsDataWithFilter.slice(
  //     offset,
  //     offset + limit,
  //   );

  //   const paginationFormattedData = paginatioRowsData.map((item) => {
  //     return {
  //       country: item.dimensionValues[0].value,
  //       sessions: Number(item.metricValues[0].value),
  //       screen_page_views: Number(item.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(item.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         item.metricValues[3].value,
  //       ),
  //       active_users: Number(item.metricValues[4].value),
  //     };
  //   });

  //   const allFormattedData = allRowsData.map((row) => {
  //     return {
  //       country: row.dimensionValues[0].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   return {
  //     paginationFormattedData,
  //     allFormattedData,
  //   };
  // }

  // async getByCountries(
  //   query: GetByCountriesQueryDto,
  //   clientId: string,
  // ): Promise<GetByCountries | PaginationServiceAiDataNotFound> {
  //   query = GoogleAnalyticsValidation.getByCountriesQuery.parse(
  //     query,
  //   ) as GetByCountriesQueryDto;

  //   // Check cache first (the cache is only for query without search)
  //   const cachedData = await this.redisService.get(
  //     clientId,
  //     this.SERVICE_NAME,
  //     'get-by-countries',
  //     query.start_date,
  //     query.end_date,
  //     true,
  //     query.order_by,
  //     query.limit,
  //     query.page,
  //   );
  //   if (cachedData && !query.search) return cachedData as GetByCountries;

  //   const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const { allDataWithFilter, allData } = await this.fetchGetByCountries(
  //     analytics,
  //     propertyId,
  //     query.start_date,
  //     query.end_date,
  //     orderBy,
  //     query.search,
  //   );

  //   // Case when data not found
  //   const isTotalDataWithFilterAvailable = allDataWithFilter?.rowCount > 0; // get all data with filter search keywords
  //   const totalDataWithFilter = isTotalDataWithFilterAvailable
  //     ? allDataWithFilter.rowCount
  //     : 0;
  //   const isPaginationDataAvailable = isTotalDataWithFilterAvailable
  //     ? totalDataWithFilter > offset
  //     : false;

  //   if (!isPaginationDataAvailable) {
  //     return {
  //       pagination: pagination(totalDataWithFilter, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const { paginationFormattedData, allFormattedData } =
  //     this.formatGetByCountries(
  //       allDataWithFilter,
  //       allData,
  //       query.limit,
  //       offset,
  //     );

  //   const analysis = await openaiAnalysis(
  //     allFormattedData,
  //     'Provides data-driven google analytics countries data analysis with specific recommendations based on the dataset.',
  //   );

  //   const paginationInfo = pagination(
  //     totalDataWithFilter,
  //     query.page,
  //     query.limit,
  //   );

  //   // Save cache to redis (only for query without search)
  //   if (!query.search) {
  //     await this.redisService.add(
  //       {
  //         clientId,
  //         service: this.SERVICE_NAME,
  //         method: 'get-by-countries',
  //         startDate: query.start_date,
  //         endDate: query.end_date,
  //         withAnalysis: true,
  //         orderBy: query.order_by,
  //         limit: query.limit,
  //         page: query.page,
  //       },
  //       {
  //         data: paginationFormattedData,
  //         pagination: paginationInfo,
  //         analysis,
  //       },
  //     );
  //   }

  //   return {
  //     pagination: paginationInfo,
  //     analysis,
  //     data: paginationFormattedData,
  //   };
  // }

  // private async fetchGetByCountry(
  //   analytics: analyticsdata_v1beta.Analyticsdata,
  //   propertyId: string,
  //   startDate: string,
  //   endDate: string,
  //   orderBy: boolean,
  //   limit: number,
  //   offset: number,
  //   country: string,
  // ) {
  //   try {
  //     const [paginationRawData, allRawData] = await Promise.all([
  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'country' }, { name: 'date' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               dimension: { dimensionName: 'date' },
  //               desc: orderBy,
  //             },
  //           ],
  //           dimensionFilter: {
  //             filter: {
  //               fieldName: 'country',
  //               stringFilter: {
  //                 value: country,
  //               },
  //             },
  //           },
  //           limit: limit.toString(),
  //           offset: offset.toString(),
  //         },
  //       }),

  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'country' }, { name: 'date' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               dimension: { dimensionName: 'date' },
  //               desc: true,
  //             },
  //           ],
  //           dimensionFilter: {
  //             filter: {
  //               fieldName: 'country',
  //               stringFilter: {
  //                 value: country,
  //               },
  //             },
  //           },
  //         },
  //       }),
  //     ]);

  //     const { data: paginationData } = paginationRawData;
  //     const { data: allData } = allRawData;

  //     return {
  //       paginationData,
  //       allData,
  //     };
  //   } catch (error) {
  //     Logger.error(error.message, 'GoogleAnalyticsService');
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetByCountry(
  //   paginationData: analyticsdata_v1beta.Schema$RunReportResponse,
  //   allData: analyticsdata_v1beta.Schema$RunReportResponse,
  // ) {
  //   const { rows: paginationRowsData } = paginationData;
  //   const { rows: allRowsData } = allData;

  //   const paginationFormattedData = paginationRowsData.map((row) => {
  //     return {
  //       date: row.dimensionValues[1].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   const allFormattedData = allRowsData.map((row) => {
  //     return {
  //       date: row.dimensionValues[1].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   return {
  //     paginationFormattedData,
  //     allFormattedData,
  //   };
  // }

  // async getByCountry(
  //   query: GetByCountryQueryDto,
  //   clientId: string,
  //   country: string,
  // ) {
  //   query = GoogleAnalyticsValidation.getByCountryQuery.parse(
  //     query,
  //   ) as GetByCountryQueryDto;

  //   country = GoogleAnalyticsValidation.getByCountryParam.parse(country);

  //   const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const { paginationData, allData } = await this.fetchGetByCountry(
  //     analytics,
  //     propertyId,
  //     query.start_date,
  //     query.end_date,
  //     orderBy,
  //     query.limit,
  //     offset,
  //     country,
  //   );

  //   // Case when data not found
  //   const isTotalDataAvailable = allData?.rowCount > 0;
  //   const totalData = isTotalDataAvailable ? allData.rowCount : 0;
  //   const isPaginationDataAvailable = paginationData?.rows?.length > 0;
  //   if (!isPaginationDataAvailable) {
  //     return {
  //       pagination: pagination(totalData, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const { paginationFormattedData, allFormattedData } =
  //     this.formatGetByCountry(paginationData, allData);

  //   const analysis = await openaiAnalysis(
  //     allFormattedData,
  //     'Provides data-driven google analytics country for each date analysis with specific recommendations based on the dataset.',
  //   );

  //   return {
  //     pagination: pagination(totalData, query.page, query.limit),
  //     analysis,
  //     data: paginationFormattedData,
  //   };
  // }

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
          dimensions: [{ name: 'fullPageUrl' }, { name: 'pageTitle' }],
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
              metric: { metricName: 'sessions' },
              desc: true,
            },
          ],
          dimensionFilter: {
            filter: {
              fieldName: 'fullPageUrl',
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
    allData: analyticsdata_v1beta.Schema$RunReportResponse,
  ) {
    const { rows: allRowsData } = allData;

    const allFormattedData = allRowsData.map((row) => {
      const bounceRate = roundNumber<string>(row.metricValues[2].value);
      const bounceRatePercent = bounceRate * 100;

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

    return allFormattedData;
  }

  async getPages(dto: GetPagesDto, clientId: string) {
    const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

    const allData = await this.fetchGetPages(
      analytics,
      propertyId,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    // Case when data not found
    const isTotalDataWithFilterAvailable = allData?.rowCount > 0;
    if (!isTotalDataWithFilterAvailable) return [] as string[];

    const formattedData = this.formatGetPages(allData);

    return formattedData;
  }

  // private async fetchGetByPage(
  //   analytics: analyticsdata_v1beta.Analyticsdata,
  //   propertyId: string,
  //   startDate: string,
  //   endDate: string,
  //   orderBy: boolean,
  //   limit: number,
  //   offset: number,
  //   page: string,
  // ) {
  //   try {
  //     const [paginationRawData, allRawData] = await Promise.all([
  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'fullPageUrl' }, { name: 'date' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               dimension: { dimensionName: 'date' },
  //               desc: orderBy,
  //             },
  //           ],
  //           dimensionFilter: {
  //             filter: {
  //               fieldName: 'fullPageUrl',
  //               stringFilter: {
  //                 value: page,
  //               },
  //             },
  //           },
  //           limit: limit.toString(),
  //           offset: offset.toString(),
  //         },
  //       }),

  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'fullPageUrl' }, { name: 'date' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               dimension: { dimensionName: 'date' },
  //               desc: true,
  //             },
  //             {
  //               metric: { metricName: 'sessions' },
  //               desc: true,
  //             },
  //           ],
  //           dimensionFilter: {
  //             filter: {
  //               fieldName: 'fullPageUrl',
  //               stringFilter: {
  //                 value: page,
  //               },
  //             },
  //           },
  //         },
  //       }),
  //     ]);

  //     const { data: paginationData } = paginationRawData;
  //     const { data: allData } = allRawData;

  //     return {
  //       paginationData,
  //       allData,
  //     };
  //   } catch (error) {
  //     Logger.error(error.message, 'GoogleAnalyticsService');
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetByPage(
  //   paginationData: analyticsdata_v1beta.Schema$RunReportResponse,
  //   allData: analyticsdata_v1beta.Schema$RunReportResponse,
  // ) {
  //   const { rows: paginationRowsData } = paginationData;
  //   const { rows: allRowsData } = allData;

  //   const paginationFormattedData = paginationRowsData.map((row) => {
  //     return {
  //       date: row.dimensionValues[1].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   const allFormattedData = allRowsData.map((row) => {
  //     return {
  //       date: row.dimensionValues[1].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   return {
  //     paginationFormattedData,
  //     allFormattedData,
  //   };
  // }

  // async getByPage(query: GetByPageQueryDto, clientId: string, page: string) {
  //   query = GoogleAnalyticsValidation.getByPageQuery.parse(
  //     query,
  //   ) as GetByPageQueryDto;

  //   page = GoogleAnalyticsValidation.getByPageParam.parse(page);

  //   const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const { paginationData, allData } = await this.fetchGetByPage(
  //     analytics,
  //     propertyId,
  //     query.start_date,
  //     query.end_date,
  //     orderBy,
  //     query.limit,
  //     offset,
  //     page,
  //   );

  //   // Case when data not found
  //   const isTotalDataAvailable = allData?.rowCount > 0;
  //   const totalData = isTotalDataAvailable ? allData.rowCount : 0;
  //   const isPaginationDataAvailable = paginationData?.rows?.length > 0;
  //   if (!isPaginationDataAvailable) {
  //     return {
  //       pagination: pagination(totalData, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const { paginationFormattedData, allFormattedData } = this.formatGetByPage(
  //     paginationData,
  //     allData,
  //   );

  //   const analysis = await openaiAnalysis(
  //     allFormattedData,
  //     'Provides data-driven google analytics page for each date analysis with specific recommendations based on the dataset.',
  //   );

  //   return {
  //     pagination: pagination(totalData, query.page, query.limit),
  //     analysis,
  //     data: paginationFormattedData,
  //   };
  // }

  // private async fetchGetOverallOrganicTraffic(
  //   analytics: analyticsdata_v1beta.Analyticsdata,
  //   propertyId: string,
  //   startDate: string,
  //   endDate: string,
  // ) {
  //   try {
  //     const { data: overallData } = await analytics.properties.runReport({
  //       property: `properties/${propertyId}`,
  //       requestBody: {
  //         dimensions: [{ name: 'sessionMedium' }],
  //         dateRanges: [{ startDate, endDate }],
  //         metrics: [
  //           { name: 'sessions' },
  //           { name: 'screenPageViews' },
  //           { name: 'bounceRate' },
  //           { name: 'averageSessionDuration' },
  //           { name: 'activeUsers' },
  //         ],
  //         dimensionFilter: {
  //           andGroup: {
  //             expressions: [
  //               {
  //                 filter: {
  //                   fieldName: 'sessionMedium',
  //                   stringFilter: {
  //                     matchType: 'EXACT',
  //                     value: 'organic',
  //                   },
  //                 },
  //               },
  //             ],
  //           },
  //         },
  //       },
  //     });
  //     return overallData;
  //   } catch (error) {
  //     Logger.error(error.message, 'GoogleAnalyticsService');
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetOverallOrganicTraffic(
  //   data: analyticsdata_v1beta.Schema$RunReportResponse,
  // ) {
  //   const metricValues = data.rows[0].metricValues;

  //   return {
  //     sessions: Number(metricValues[0].value),
  //     screen_page_views: Number(metricValues[1].value),
  //     bounce_rate: roundNumber<string>(metricValues[2].value),
  //     average_session_duration: roundNumber<string>(metricValues[3].value),
  //     active_users: Number(metricValues[4].value),
  //   };
  // }

  // // Organic traffic refers to the visitors who arrive at a website through unpaid search results
  // async getOverallOrganicTraffic(
  //   query: GetOverallOrganicTrafficQueryDto,
  //   clientId: string,
  // ) {
  //   query = GoogleAnalyticsValidation.getOverallOrganicTrafficQuery.parse(
  //     query,
  //   ) as GetOverallOrganicTrafficQueryDto;

  //   const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

  //   const overallData = await this.fetchGetOverallOrganicTraffic(
  //     analytics,
  //     propertyId,
  //     query.end_date,
  //     query.end_date,
  //   );

  //   // Case when data not found
  //   const hasData = overallData?.rowCount > 0;
  //   if (!hasData) {
  //     return {
  //       analysis: 'No data found',
  //       data: {},
  //     };
  //   }

  //   const overallFormattedData =
  //     this.formatGetOverallOrganicTraffic(overallData);

  //   const analysis = await openaiAnalysis(
  //     overallFormattedData,
  //     'Provides data-driven google analytics overall organic traffic data analysis with specific recommendations based on the dataset.',
  //   );

  //   return {
  //     analysis,
  //     data: overallFormattedData,
  //   };
  // }

  // private async fetchGetDailyOrganicTraffic(
  //   analytics: analyticsdata_v1beta.Analyticsdata,
  //   propertyId: string,
  //   startDate: string,
  //   endDate: string,
  //   orderBy: boolean,
  //   limit: number,
  //   offset: number,
  // ) {
  //   try {
  //     const [paginationRawData, allRawData] = await Promise.all([
  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'date' }, { name: 'sessionMedium' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               dimension: { dimensionName: 'date' },
  //               desc: orderBy,
  //             },
  //           ],
  //           dimensionFilter: {
  //             andGroup: {
  //               expressions: [
  //                 {
  //                   filter: {
  //                     fieldName: 'sessionMedium',
  //                     stringFilter: {
  //                       matchType: 'EXACT',
  //                       value: 'organic',
  //                     },
  //                   },
  //                 },
  //               ],
  //             },
  //           },
  //           limit: limit.toString(),
  //           offset: offset.toString(),
  //         },
  //       }),

  //       analytics.properties.runReport({
  //         property: `properties/${propertyId}`,
  //         requestBody: {
  //           dimensions: [{ name: 'date' }],
  //           dateRanges: [{ startDate, endDate }],
  //           metrics: [
  //             { name: 'sessions' },
  //             { name: 'screenPageViews' },
  //             { name: 'bounceRate' },
  //             { name: 'averageSessionDuration' },
  //             { name: 'activeUsers' },
  //           ],
  //           orderBys: [
  //             {
  //               dimension: { dimensionName: 'date' },
  //               desc: true,
  //             },
  //           ],
  //         },
  //       }),
  //     ]);

  //     const { data: paginationData } = paginationRawData;
  //     const { data: allData } = allRawData;

  //     return {
  //       paginationData,
  //       allData,
  //     };
  //   } catch (error) {
  //     Logger.error(error.message, 'GoogleAnalyticsService');
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetDailyOrganicTraffic(
  //   paginationData: analyticsdata_v1beta.Schema$RunReportResponse,
  //   allData: analyticsdata_v1beta.Schema$RunReportResponse,
  // ) {
  //   const { rows: paginationRowsData } = paginationData;
  //   const { rows: allRowsData } = allData;

  //   const paginationFormattedData = paginationRowsData.map((row) => {
  //     return {
  //       date: row.dimensionValues[0].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   const allFormattedData = allRowsData.map((row) => {
  //     return {
  //       date: row.dimensionValues[0].value,
  //       sessions: Number(row.metricValues[0].value),
  //       screen_page_views: Number(row.metricValues[1].value),
  //       bounce_rate: roundNumber<string>(row.metricValues[2].value),
  //       average_session_duration: roundNumber<string>(
  //         row.metricValues[3].value,
  //       ),
  //       active_users: Number(row.metricValues[4].value),
  //     };
  //   });

  //   return {
  //     paginationFormattedData,
  //     allFormattedData,
  //   };
  // }

  // async getDailyOrganicTraffic(
  //   query: GetDailyOrganicTrafficQueryDto,
  //   clientId: string,
  // ) {
  //   query = GoogleAnalyticsValidation.getDailyOrganicTrafficQuery.parse(
  //     query,
  //   ) as GetDailyOrganicTrafficQueryDto;

  //   const { propertyId, analytics } = await this.getGoogleAnalytics(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const { paginationData, allData } = await this.fetchGetDailyOrganicTraffic(
  //     analytics,
  //     propertyId,
  //     query.start_date,
  //     query.end_date,
  //     orderBy,
  //     query.limit,
  //     offset,
  //   );

  //   // Case when data not found
  //   const isTotalDataAvailable = allData?.rowCount > 0;
  //   const totalData = isTotalDataAvailable ? allData.rowCount : 0;
  //   const isPaginationDataAvailable = paginationData?.rows?.length > 0;
  //   if (!isPaginationDataAvailable) {
  //     return {
  //       pagination: pagination(totalData, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const { paginationFormattedData, allFormattedData } =
  //     this.formatGetDailyOrganicTraffic(paginationData, allData);

  //   const analysis = await openaiAnalysis(
  //     allFormattedData,
  //     'Provides data-driven google analytics daily organic traffic data analysis with specific recommendations based on the dataset.',
  //   );

  //   return {
  //     pagination: pagination(totalData, query.page, query.limit),
  //     analysis,
  //     data: paginationFormattedData,
  //   };
  // }

  // async getAllPropertyIds(clientId: string) {
  //   const oauth2Client = await this.getOauth2Client(clientId);

  //   const analytics = google.analyticsadmin({
  //     version: 'v1beta',
  //     auth: oauth2Client,
  //   });

  //   const rawAccount = await analytics.accounts.list();
  //   const account = rawAccount.data?.accounts?.[0];
  //   if (!account) return [] as string[];

  //   const propertiesResponse = await analytics.properties.list({
  //     filter: `parent:${account.name}`,
  //   });

  //   const properties = propertiesResponse.data?.properties;
  //   if (!properties) return [] as string[];

  //   const formattedProperties = properties.map((property) => {
  //     const propertyId = property.name.split('/').pop();
  //     const name = property.displayName;

  //     return {
  //       property_id: propertyId,
  //       name,
  //     };
  //   });

  //   return formattedProperties;
  // }

  // async getCurrentProperty(clientId: string) {
  //   const propertyId = await this.getPropertyId(clientId);
  //   const oauth2Client = await this.getOauth2Client(clientId);

  //   const analyticsAdmin = google.analyticsadmin({
  //     version: 'v1beta',
  //     auth: oauth2Client,
  //   });

  //   const propertyResponse = await analyticsAdmin.properties.get({
  //     name: `properties/${propertyId}`,
  //   });

  //   const property = propertyResponse.data;

  //   return {
  //     property_id: propertyId,
  //     name: property.displayName,
  //   };
  // }
}
