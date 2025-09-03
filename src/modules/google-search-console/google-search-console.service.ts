/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger, HttpException } from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { roundNumber } from 'src/utils/global.utils';
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import ISO from 'iso-3166-1';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetKeywordsDto } from './dto/get-keywords.dto';
// import { RedisService } from '../common/service/redis.service';

@Injectable()
export class GoogleSearchConsoleService {
  private readonly oauth2ClientSchema: OAuth2ClientOptions;
  private readonly SERVICE_NAME = 'google-search-console';
  private readonly STATIC_OAUTH2_CLIENT_FOR_TESTING: any;
  private readonly STATIC_GOOGLE_SEARCH_CONSOLE_FOR_TESTING: any;

  constructor(
    private readonly configService: ConfigService,
    // private readonly redisService: RedisService,
  ) {
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

    this.STATIC_GOOGLE_SEARCH_CONSOLE_FOR_TESTING = {
      property: this.configService.getOrThrow('TESTING_GSC_PROPERTY'),
      property_type: this.configService.getOrThrow('TESTING_GSC_PROPERTY_TYPE'),
    };
  }

  private async getOauth2Client(clientId: string) {
    // const { data: googleOauth, error } = await this.supabaseService
    //   .getClient()
    //   .from('google_oauth')
    //   .select('access_token, refresh_token, expiry_date, scope')
    //   .eq('client_id', clientId)
    //   .maybeSingle();

    // if (error) {
    //   Logger.error(
    //     'Failed to get google oauth tokens',
    //     error.message,
    //     'GoogleSearchConsoleService',
    //   );
    //   throw new HttpException('Failed to get google oauth tokens', 500);
    // }

    const googleOauth = this.STATIC_OAUTH2_CLIENT_FOR_TESTING;

    const { access_token, refresh_token, expiry_date, scope } =
      googleOauth || {};

    if (!access_token || !refresh_token || !expiry_date || !scope) {
      throw new HttpException('Google OAuth is required', 404);
    }

    const scopeArray = scope.trim().split(' ');
    const isGoogleSearchConsoleScope = scopeArray.includes(
      'https://www.googleapis.com/auth/webmasters.readonly',
    );
    if (!isGoogleSearchConsoleScope) {
      throw new HttpException(
        'google search console scope is required on google oauth',
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

  private async getSiteUrl(clientId: string) {
    // const { data: googleSearchConsole, error } = await this.supabaseService
    //   .getClient()
    //   .from('google_search_console')
    //   .select('property, property_type')
    //   .eq('client_id', clientId)
    //   .maybeSingle();

    // if (error) {
    //   Logger.error(
    //     'error fetching google search console property from supabase',
    //     error.message,
    //     'GoogleSearchConsoleService',
    //   );
    //   throw new HttpException(
    //     'error fetching google search console property from supabase',
    //     500,
    //   );
    // }

    // for testing only
    const googleSearchConsole = this.STATIC_GOOGLE_SEARCH_CONSOLE_FOR_TESTING;

    const { property, property_type } = googleSearchConsole || {};

    if (!property || !property_type) {
      throw new HttpException(
        'google search console property and property_type are required',
        404,
      );
    }

    const siteUrl: string =
      property_type === 'domain' ? `sc-domain:${property}` : property;

    return siteUrl;
  }

  private async getGoogleSearchConsole(clientId: string) {
    const [oauth2Client, siteUrl] = await Promise.all([
      this.getOauth2Client(clientId),
      this.getSiteUrl(clientId),
    ]);

    const searchConsole: searchconsole_v1.Searchconsole = google.searchconsole({
      version: 'v1',
      auth: oauth2Client,
    });

    return {
      searchConsole,
      siteUrl,
    };
  }

  private getFullCountryName(countryCode: string): string {
    try {
      let country = ISO.whereAlpha2(countryCode.toUpperCase()); // 2 letter codes

      // If that fails, try 3-letter codes
      if (!country && countryCode.length === 3) {
        country = ISO.whereAlpha3(countryCode.toUpperCase());
      }

      return country?.country || countryCode;
    } catch (error) {
      console.warn(`Unable to get country name for code: ${countryCode}`);
      return countryCode;
    }
  }

  private async fetchGetOverall(
    searchConsole: searchconsole_v1.Searchconsole,
    siteUrl: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const { data } = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
        },
      });
      return data;
    } catch (error) {
      Logger.error(
        'access denied error',
        error.message,
        'GoogleSearchConsoleService',
      );
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetOverall(
    data: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const metricValues = data.rows[0];
    return {
      clicks: metricValues.clicks,
      impressions: metricValues.impressions,
      ctr_percent: roundNumber<number>(metricValues.ctr * 100),
      average_position: roundNumber<number>(metricValues.position),
    };
  }

  // already organic traffic (it's for all endpoint that use search console)
  async getOverall(dto: GetOverallDto, clientId: string) {
    // Check cache first
    // const cachedData = await this.redisService.get(
    //   clientId,
    //   this.SERVICE_NAME,
    //   'get-overall',
    //   query.start_date,
    //   query.end_date,
    //   withAnalysis,
    // );
    // if (cachedData) return cachedData as GetOverall;

    const { searchConsole, siteUrl } =
      await this.getGoogleSearchConsole(clientId);

    const overallData = await this.fetchGetOverall(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = overallData.rows?.[0];
    if (!hasData) return {};

    const overallFormattedData = this.formatGetOverall(overallData);

    // Save cache to redis
    // await this.redisService.add(
    //   {
    //     clientId,
    //     service: this.SERVICE_NAME,
    //     method: 'get-overall',
    //     startDate: query.start_date,
    //     endDate: query.end_date,
    //     withAnalysis,
    //   },
    //   {
    //     data: overallFormattedData,
    //   },
    // );

    return overallFormattedData;
  }

  private async fetchGetDaily(
    searchConsole: searchconsole_v1.Searchconsole,
    siteUrl: string,
    startDate: string,
    endDate: string,
  ) {
    try {
      const { data } = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['date'],
        },
      });

      return data;
    } catch (error) {
      Logger.error(
        'access denied error',
        error.message,
        'GoogleSearchConsoleService',
      );
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetDaily(
    allData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const allFormattedData = allData.rows.map((item) => ({
      date: item.keys[0],
      clicks: item.clicks,
      impressions: item.impressions,
      ctr_percent: roundNumber<number>(item.ctr * 100),
      average_position: roundNumber<number>(item.position),
    }));

    return allFormattedData;
  }

  async getDaily(dto: GetDailyDto, clientId: string) {
    // Check cache first
    // const cachedData = await this.redisService.get(
    //   clientId,
    //   this.SERVICE_NAME,
    //   'get-daily',
    //   query.start_date,
    //   query.end_date,
    //   true,
    //   query.order_by,
    //   query.limit,
    //   query.page,
    // );
    // if (cachedData) return cachedData as GetDaily;

    const { searchConsole, siteUrl } =
      await this.getGoogleSearchConsole(clientId);

    const allData = await this.fetchGetDaily(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
    );

    const formattedData = this.formatGetDaily(allData);

    // Save cache to redis
    // await this.redisService.add(
    //   {
    //     clientId,
    //     service: this.SERVICE_NAME,
    //     method: 'get-daily',
    //     startDate: query.start_date,
    //     endDate: query.end_date,
    //     withAnalysis: true,
    //     orderBy: query.order_by,
    //     limit: query.limit,
    //     page: query.page,
    //   },
    //   {
    //     pagination: paginationInfo,
    //     analysis,
    //     data: paginationFormattedData,
    //   },
    // );

    return formattedData;
  }

  private async fetchGetKeywords(
    searchConsole: searchconsole_v1.Searchconsole,
    siteUrl: string,
    startDate: string,
    endDate: string,
    limit: number,
    search: string,
  ) {
    try {
      const { data } = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  operator: 'contains',
                  expression: search,
                },
              ],
            },
          ],
          rowLimit: limit,
          // orderBy: [
          //   {
          //     field: 'clicks',
          //     sortOrder: 'ASCENDING',
          //   },
          // ],
        },
      });

      return data;
    } catch (error) {
      Logger.error(
        'access denied error',
        error.message,
        'GoogleSearchConsoleService',
      );
      throw new HttpException(error.message, 403);
    }
  }

  private formatGetKeywords(
    allData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const { rows: allRowsData } = allData;
    console.log(allRowsData);

    const allFormattedData = allRowsData.map((item) => ({
      keyword: item.keys[0],
      clicks: item.clicks,
      impressions: item.impressions,
      ctr_percent: roundNumber<number>(item.ctr * 100),
      average_position: roundNumber<number>(item.position),
    }));

    return allFormattedData;
  }

  async getKeywords(dto: GetKeywordsDto, clientId: string) {
    // Check cache first (the cache is only for query without search)
    // const cachedData = await this.redisService.get(
    //   clientId,
    //   this.SERVICE_NAME,
    //   'get-keywords',
    //   query.start_date,
    //   query.end_date,
    //   true,
    //   query.order_by,
    //   query.limit,
    //   query.page,
    // );
    // if (cachedData) return cachedData as GetKeywords;

    const { searchConsole, siteUrl } =
      await this.getGoogleSearchConsole(clientId);

    const allData = await this.fetchGetKeywords(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    const formattedData = this.formatGetKeywords(allData);

    // Save cache to redis (only for query without search)
    // if (!query.search) {
    //   await this.redisService.add(
    //     {
    //       clientId,
    //       service: this.SERVICE_NAME,
    //       method: 'get-keywords',
    //       startDate: query.start_date,
    //       endDate: query.end_date,
    //       withAnalysis: true,
    //       orderBy: query.order_by,
    //       limit: query.limit,
    //       page: query.page,
    //     },
    //     {
    //       pagination: paginationInfo,
    //       analysis,
    //       data: paginationFormattedData,
    //     },
    //   );
    // }

    return formattedData;
  }

  // private async fetchGetByKeyword(
  //   searchConsole: searchconsole_v1.Searchconsole,
  //   siteUrl: string,
  //   startDate: string,
  //   endDate: string,
  //   limit: number,
  //   offset: number,
  //   keyword: string,
  // ) {
  //   try {
  //     const [paginationRawData, allRawData] = await Promise.all([
  //       searchConsole.searchanalytics.query({
  //         siteUrl,
  //         requestBody: {
  //           startDate,
  //           endDate,
  //           dimensions: ['query', 'date'],
  //           rowLimit: limit,
  //           startRow: offset,
  //           dimensionFilterGroups: [
  //             {
  //               filters: [
  //                 {
  //                   dimension: 'query',
  //                   expression: keyword,
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       }),

  //       searchConsole.searchanalytics.query({
  //         siteUrl,
  //         requestBody: {
  //           startDate,
  //           endDate,
  //           dimensions: ['query', 'date'],
  //           dimensionFilterGroups: [
  //             {
  //               filters: [
  //                 {
  //                   dimension: 'query',
  //                   expression: keyword,
  //                 },
  //               ],
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
  //     Logger.error(
  //       `access denied error`,
  //       error.message,
  //       'GoogleSearchConsoleService',
  //     );
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetByKeyword(
  //   paginationData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  //   allData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  //   orderBy: boolean,
  // ) {
  //   const { rows: paginationRowsData } = paginationData;
  //   const { rows: allRowsData } = allData;

  //   const paginationFormattedData = paginationRowsData
  //     .map((item) => ({
  //       date: item.keys[1],
  //       clicks: item.clicks,
  //       impressions: item.impressions,
  //       ctr: roundNumber<number>(item.ctr),
  //       position: roundNumber<number>(item.position),
  //     }))
  //     .sort((a, b) => {
  //       if (orderBy)
  //         return new Date(b.date).getTime() - new Date(a.date).getTime();
  //       else return new Date(a.date).getTime() - new Date(b.date).getTime();
  //     });

  //   const allFormattedData = allRowsData
  //     .map((item) => ({
  //       date: item.keys[1],
  //       clicks: item.clicks,
  //       impressions: item.impressions,
  //       ctr: item.ctr,
  //       position: item.position,
  //     }))
  //     .sort((a, b) => {
  //       if (orderBy)
  //         return new Date(b.date).getTime() - new Date(a.date).getTime();
  //       else return new Date(a.date).getTime() - new Date(b.date).getTime();
  //     });

  //   return {
  //     paginationFormattedData,
  //     allFormattedData,
  //   };
  // }

  // async getByKeyword(
  //   query: GetByKeywordQueryDto,
  //   clientId: string,
  //   keyword: string,
  // ) {
  //   query = GoogleSearchConsoleValidation.getByKeywordQuery.parse(
  //     query,
  //   ) as GetByKeywordQueryDto;

  //   keyword = GoogleSearchConsoleValidation.getByKeywordParam.parse(keyword);

  //   const { searchConsole, siteUrl } =
  //     await this.getGoogleSearchConsole(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const { paginationData, allData } = await this.fetchGetByKeyword(
  //     searchConsole,
  //     siteUrl,
  //     query.start_date,
  //     query.end_date,
  //     query.limit,
  //     offset,
  //     keyword,
  //   );

  //   // Case when data not found
  //   const isTotalDataAvailable = allData?.rows?.length > 0;
  //   const totalData = isTotalDataAvailable ? allData.rows.length : 0;
  //   const isPaginationDataAvailable = paginationData?.rows?.length > 0;
  //   if (!isPaginationDataAvailable) {
  //     return {
  //       pagination: pagination(totalData, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const { paginationFormattedData, allFormattedData } =
  //     this.formatGetByKeyword(paginationData, allData, orderBy);

  //   const analysis = await openaiAnalysis(
  //     allFormattedData,
  //     'Provides data-driven daily google search console keywords analysis with specific recommendations based on the dataset.',
  //   );

  //   return {
  //     pagination: pagination(totalData, query.page, query.limit),
  //     analysis,
  //     data: paginationFormattedData,
  //   };
  // }

  // private async fetchGetCountries(
  //   searchConsole: searchconsole_v1.Searchconsole,
  //   siteUrl: string,
  //   startDate: string,
  //   endDate: string,
  // ) {
  //   try {
  //     const { data: allData } = await searchConsole.searchanalytics.query({
  //       siteUrl,
  //       requestBody: {
  //         startDate,
  //         endDate,
  //         dimensions: ['country'],
  //         // removed because filters search by country full name not abbreviation name
  //         // dimensionFilterGroups: [
  //         //   {
  //         //     filters: [
  //         //       {
  //         //         dimension: 'country',
  //         //         operator: 'contains',
  //         //         expression: query.search,
  //         //       },
  //         //     ],
  //         //   },
  //         // ],
  //         // removed because filters need pagination manually
  //         // rowLimit: limit,
  //         // startRow: offset,
  //       },
  //     });
  //     return allData;
  //   } catch (error) {
  //     Logger.error(
  //       'access denied error',
  //       error.message,
  //       'GoogleSearchConsoleService',
  //     );
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetCountries(
  //   allData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  //   orderBy: boolean,
  // ) {
  //   const { rows: allRowsData } = allData;

  //   const allFormattedData = allRowsData
  //     .map((item) => ({
  //       id: item.keys[0],
  //       name: this.getFullCountryName(item.keys[0]),
  //       clicks: item.clicks,
  //       impressions: item.impressions,
  //       ctr: roundNumber<number>(item.ctr),
  //       position: roundNumber<number>(item.position),
  //     }))
  //     .sort((a, b) => {
  //       if (orderBy) return b.clicks - a.clicks;
  //       else return a.clicks - b.clicks;
  //     });

  //   return allFormattedData;
  // }

  // private filterGetCountries(
  //   allFormattedData: {
  //     id: string;
  //     name: string;
  //     clicks: number;
  //     impressions: number;
  //     ctr: number;
  //     position: number;
  //   }[],
  //   limit: number,
  //   offset: number,
  //   search: string,
  // ) {
  //   const allFormattedDataWithFilter = search
  //     ? allFormattedData.filter((item) =>
  //         item.name.toLowerCase().includes(search.toLowerCase()),
  //       )
  //     : allFormattedData;

  //   const paginationFormattedData = allFormattedDataWithFilter.slice(
  //     offset,
  //     offset + limit,
  //   );

  //   return {
  //     paginationFormattedData,
  //     allFormattedDataWithFilter,
  //   };
  // }

  // async getCountries(
  //   query: GetCountriesQueryDto,
  //   clientId: string,
  // ): Promise<GetCountries | PaginationServiceAiDataNotFound> {
  //   query = GoogleSearchConsoleValidation.getCountriesQuery.parse(
  //     query,
  //   ) as GetCountriesQueryDto;

  //   // Check cache first (the cache is only for query without search)
  //   const cachedData = await this.redisService.get(
  //     clientId,
  //     this.SERVICE_NAME,
  //     'get-countries',
  //     query.start_date,
  //     query.end_date,
  //     true,
  //     query.order_by,
  //     query.limit,
  //     query.page,
  //   );
  //   if (cachedData) return cachedData as GetCountries;

  //   const { searchConsole, siteUrl } =
  //     await this.getGoogleSearchConsole(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const allData = await this.fetchGetCountries(
  //     searchConsole,
  //     siteUrl,
  //     query.start_date,
  //     query.end_date,
  //   );

  //   // Case when data not found
  //   const hasData = allData?.rows?.length > 0;
  //   if (!hasData) {
  //     return {
  //       pagination: pagination(0, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const allFormattedData = this.formatGetCountries(allData, orderBy);

  //   const { paginationFormattedData, allFormattedDataWithFilter } =
  //     this.filterGetCountries(
  //       allFormattedData,
  //       query.limit,
  //       offset,
  //       query.search,
  //     );

  //   // Case when paginated data is []
  //   const totalDataWithFilter = allFormattedDataWithFilter.length;
  //   const totalPaginationFormattedData = paginationFormattedData.length;
  //   if (totalPaginationFormattedData === 0) {
  //     return {
  //       pagination: pagination(totalDataWithFilter, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const analysis = await openaiAnalysis(
  //     allFormattedDataWithFilter,
  //     'Provides data-driven google search console by countries analysis with specific recommendations based on the dataset.',
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
  //         method: 'get-countries',
  //         startDate: query.start_date,
  //         endDate: query.end_date,
  //         withAnalysis: true,
  //         orderBy: query.order_by,
  //         limit: query.limit,
  //         page: query.page,
  //       },
  //       {
  //         pagination: paginationInfo,
  //         analysis,
  //         data: paginationFormattedData,
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
  //   searchConsole: searchconsole_v1.Searchconsole,
  //   siteUrl: string,
  //   startDate: string,
  //   endDate: string,
  //   limit: number,
  //   offset: number,
  //   country: string,
  // ) {
  //   try {
  //     const [paginationRawData, allRawData] = await Promise.all([
  //       searchConsole.searchanalytics.query({
  //         siteUrl,
  //         requestBody: {
  //           startDate,
  //           endDate,
  //           dimensions: ['country', 'date'],
  //           rowLimit: limit,
  //           startRow: offset,
  //           dimensionFilterGroups: [
  //             {
  //               filters: [
  //                 {
  //                   dimension: 'country',
  //                   expression: country,
  //                 },
  //               ],
  //             },
  //           ],
  //         },
  //       }),

  //       searchConsole.searchanalytics.query({
  //         siteUrl,
  //         requestBody: {
  //           startDate,
  //           endDate,
  //           dimensions: ['country', 'date'],
  //           dimensionFilterGroups: [
  //             {
  //               filters: [
  //                 {
  //                   dimension: 'country',
  //                   expression: country,
  //                 },
  //               ],
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
  //     Logger.error(
  //       'access denied error',
  //       error.message,
  //       'GoogleSearchConsoleService',
  //     );
  //     throw new HttpException(error.message, 403);
  //   }
  // }

  // private formatGetByCountry(
  //   paginationData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  //   allData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  //   orderBy: boolean,
  // ) {
  //   const { rows: paginationRowsData } = paginationData;
  //   const { rows: allRowsData } = allData;

  //   const paginationFormattedData = paginationRowsData
  //     .map((item) => ({
  //       date: item.keys[1],
  //       clicks: item.clicks,
  //       impressions: item.impressions,
  //       ctr: roundNumber<number>(item.ctr),
  //       position: roundNumber<number>(item.position),
  //     }))
  //     .sort((a, b) => {
  //       if (orderBy)
  //         return new Date(b.date).getTime() - new Date(a.date).getTime();
  //       else return new Date(a.date).getTime() - new Date(b.date).getTime();
  //     });

  //   const allFormattedData = allRowsData
  //     .map((item) => ({
  //       date: item.keys[1],
  //       clicks: item.clicks,
  //       impressions: item.impressions,
  //       ctr: item.ctr,
  //       position: item.position,
  //     }))
  //     .sort((a, b) => {
  //       if (orderBy)
  //         return new Date(b.date).getTime() - new Date(a.date).getTime();
  //       else return new Date(a.date).getTime() - new Date(b.date).getTime();
  //     });

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
  //   query = GoogleSearchConsoleValidation.getByCountryQuery.parse(
  //     query,
  //   ) as GetByCountryQueryDto;

  //   country = GoogleSearchConsoleValidation.getByCountryParam.parse(country);

  //   const { searchConsole, siteUrl } =
  //     await this.getGoogleSearchConsole(clientId);

  //   // pagination
  //   const offset = (query.page - 1) * query.limit;
  //   const orderBy = query.order_by === 'desc' ? true : false;

  //   const { paginationData, allData } = await this.fetchGetByCountry(
  //     searchConsole,
  //     siteUrl,
  //     query.start_date,
  //     query.end_date,
  //     query.limit,
  //     offset,
  //     country,
  //   );

  //   // Case when data not found
  //   const isTotalDataAvailable = allData?.rows?.length > 0;
  //   const totalData = isTotalDataAvailable ? allData.rows.length : 0;
  //   const isPaginationDataAvailable = paginationData?.rows?.length > 0;
  //   if (!isPaginationDataAvailable) {
  //     return {
  //       pagination: pagination(totalData, query.page, query.limit),
  //       analysis: 'No data found',
  //       data: [] as string[],
  //     };
  //   }

  //   const { paginationFormattedData, allFormattedData } =
  //     this.formatGetByCountry(paginationData, allData, orderBy);

  //   const analysis = await openaiAnalysis(
  //     allFormattedData,
  //     'Provides data-driven daily google search console by country analysis with specific recommendations based on the dataset.',
  //   );

  //   return {
  //     pagination: pagination(totalData, query.page, query.limit),
  //     analysis,
  //     data: paginationFormattedData,
  //   };
  // }

  // async getAllProperty(clientId: string) {
  //   const oauth2Client = await this.getOauth2Client(clientId);

  //   const searchConsole = google.searchconsole({
  //     version: 'v1',
  //     auth: oauth2Client,
  //   });

  //   const sitesResponse = await searchConsole.sites.list();

  //   if (
  //     !sitesResponse.data.siteEntry ||
  //     sitesResponse.data.siteEntry.length === 0
  //   ) {
  //     return [] as string[];
  //   }

  //   const formattedProperties = sitesResponse.data.siteEntry.map((site) => {
  //     const { siteUrl } = site || {};
  //     const propertyType = siteUrl?.startsWith('sc-domain:')
  //       ? 'domain'
  //       : 'url_prefix';

  //     const propertyName =
  //       propertyType === 'domain' ? siteUrl.replace('sc-domain:', '') : siteUrl;

  //     return {
  //       property_type: propertyType,
  //       property: propertyName,
  //     };
  //   });

  //   return formattedProperties;
  // }
}
