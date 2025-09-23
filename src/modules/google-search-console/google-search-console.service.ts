/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { google, searchconsole_v1 } from 'googleapis';
import { ConfigService } from '@nestjs/config';
import { roundNumber } from 'src/utils/global.utils';
import ISO from 'iso-3166-1';
import { GetOverallDto } from './dto/get-overall.dto';
import { GetDailyDto } from './dto/get-daily.dto';
import { GetKeywordsDto } from './dto/get-keywords.dto';
import { GetByKeywordDto } from './dto/get-by-keyword.dto';
import { compareAsc } from 'date-fns';
import { GetCountriesDto } from './dto/get-countries.dto';
import { GetByCountryDto } from './dto/get-by-country.dto';
import { GoogleOauthService } from '../google-oauth/google-oauth.service';
import { Platform } from '../google-oauth/google-oauth.enum';
import { GoogleSearchConsoleRepository } from './google-search-console.repository';
import { PropertyType } from '../platform/platform.enum';
import { GoogleSearchConsole } from '../platform/entities/google-search-console.entity';
// import { RedisService } from '../common/service/redis.service';

@Injectable()
export class GoogleSearchConsoleService {
  private readonly SERVICE_NAME = Platform.GOOGLE_SEARCH_CONSOLE;
  private readonly logger = new Logger(GoogleSearchConsoleService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleSearchConsoleRepository: GoogleSearchConsoleRepository,
    // private readonly redisService: RedisService,
  ) {}

  private async getGoogleSearchConsole(clientId: string) {
    const [property, currentOauth2Client] = await Promise.all([
      this.googleSearchConsoleRepository.getProperty(clientId),
      this.googleOauthService.getOauth2Client(this.SERVICE_NAME, clientId),
    ]);

    const { property_type, property_name } = property || {};

    const siteUrl =
      property_type === PropertyType.DOMAIN
        ? `sc-domain:${property_name}`
        : property_name;

    const { data: oauth2Client, error } = currentOauth2Client;
    if (error) {
      throw new NotFoundException(error);
    }

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
    const code = countryCode.toUpperCase();

    // Special case
    const specialCodes: Record<string, string> = {
      ZZZ: 'Unknown Country',
      XKK: 'Kosovo',
    };

    if (specialCodes[code]) {
      return specialCodes[code];
    }

    const { country } = ISO.whereAlpha3(code); // 3 letter codes
    return country;
  }

  private getCountryCode(countryName: string): string | null {
    const allCountries = ISO.all();

    // try exact match first (case-insensitive)
    const exactMatch = allCountries.find(
      (c) => c.country.toLowerCase() === countryName.toLowerCase(),
    );

    if (exactMatch) return exactMatch.alpha3; // return 3 letter code

    // if not found, try partial match
    const partialMatches = allCountries.filter(
      (c) =>
        c.country.toLowerCase().includes(countryName.toLowerCase()) ||
        countryName.toLowerCase().includes(c.country.toLowerCase()),
    );

    // if exactly 1 match, return it
    if (partialMatches.length === 1) return partialMatches[0].alpha3;

    this.logger.error(`count ${partialMatches.length} for ${countryName}`);

    // if matches > 1 or matches == 0, return null
    return null;
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
      this.logger.error(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  private formatGetOverall(
    rawData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const metricValues = rawData.rows[0];
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

    const rawData = await this.fetchGetOverall(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = rawData.rows?.[0];
    if (!hasData) return {};

    const formattedData = this.formatGetOverall(rawData);

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

    return formattedData;
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
      this.logger.error(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  private formatGetDaily(
    rawData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const allFormattedData = rawData.rows.map((item) => ({
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

    const rawData = await this.fetchGetDaily(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
    );

    const hasData = rawData?.rows?.length > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetDaily(rawData);

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
        },
      });

      return data;
    } catch (error) {
      this.logger.error(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  private formatGetKeywords(
    rawData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const { rows } = rawData;

    const allFormattedData = rows
      .map((item) => ({
        keyword: item.keys[0],
        clicks: item.clicks,
        impressions: item.impressions,
        ctr_percent: roundNumber<number>(item.ctr * 100),
        average_position: roundNumber<number>(item.position),
      }))
      .sort((a, b) => b.ctr_percent - a.ctr_percent);

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

    const rawData = await this.fetchGetKeywords(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
      dto.limit,
      dto.search,
    );

    const hasData = rawData?.rows?.length > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetKeywords(rawData);

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

  private async fetchGetByKeyword(
    searchConsole: searchconsole_v1.Searchconsole,
    siteUrl: string,
    startDate: string,
    endDate: string,
    keyword: string,
  ) {
    try {
      const { data } = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query', 'date'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'query',
                  expression: keyword,
                },
              ],
            },
          ],
          aggregationType: 'byPage',
        },
      });

      return data;
    } catch (error) {
      this.logger.error(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  private formatGetByKeyword(
    rawData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows
      .map((item) => ({
        date: item.keys[1],
        clicks: item.clicks,
        impressions: item.impressions,
        ctr_percent: roundNumber<number>(item.ctr * 100),
        average_position: roundNumber<number>(item.position),
      }))
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));

    return formattedData;
  }

  async getByKeyword(dto: GetByKeywordDto, keyword: string, clientId: string) {
    const { searchConsole, siteUrl } =
      await this.getGoogleSearchConsole(clientId);

    const rawData = await this.fetchGetByKeyword(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
      keyword,
    );

    const hasData = rawData?.rows?.length > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetByKeyword(rawData);

    return formattedData;
  }

  private async fetchGetCountries(
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
          dimensions: ['country'],
          // removed because filters search by country full name not abbreviation name
          // dimensionFilterGroups: [
          //   {
          //     filters: [
          //       {
          //         dimension: 'country',
          //         operator: 'contains',
          //         expression: query.search,
          //       },
          //     ],
          //   },
          // ],
          // removed because filters need pagination manually
          // rowLimit: limit,
          // startRow: offset,
        },
      });
      return data;
    } catch (error) {
      this.logger.error(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  private formatGetCountries(
    rawData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
    limit: number,
    search: string,
  ) {
    const { rows } = rawData;

    // format data first
    const formattedData = rows.map((item) => ({
      // id: item.keys[0], // for debug only
      country: this.getFullCountryName(item.keys[0]),
      clicks: item.clicks,
      impressions: item.impressions,
      ctr_percent: roundNumber<number>(item.ctr * 100),
      average_position: roundNumber<number>(item.position),
    }));

    // then filter by search
    const filteredData = search
      ? formattedData.filter(({ country }) => country.includes(search))
      : formattedData;

    // then sort by impressions desc
    const sortedData = filteredData.sort(
      (a, b) => b.ctr_percent - a.ctr_percent,
    );

    // then limit
    const limitedData = sortedData.slice(0, limit);

    return limitedData;
  }

  async getCountries(dto: GetCountriesDto, clientId: string) {
    // Check cache first (the cache is only for query without search)
    // const cachedData = await this.redisService.get(
    //   clientId,
    //   this.SERVICE_NAME,
    //   'get-countries',
    //   query.start_date,
    //   query.end_date,
    //   true,
    //   query.order_by,
    //   query.limit,
    //   query.page,
    // );
    // if (cachedData) return cachedData as GetCountries;

    const { searchConsole, siteUrl } =
      await this.getGoogleSearchConsole(clientId);

    const rawData = await this.fetchGetCountries(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
    );

    // Case when data not found
    const hasData = rawData?.rows?.length > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetCountries(
      rawData,
      dto.limit,
      dto.search,
    );

    // Save cache to redis (only for query without search)
    // if (!query.search) {
    //   await this.redisService.add(
    //     {
    //       clientId,
    //       service: this.SERVICE_NAME,
    //       method: 'get-countries',
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

  private async fetchGetByCountry(
    searchConsole: searchconsole_v1.Searchconsole,
    siteUrl: string,
    startDate: string,
    endDate: string,
    countryCode: string,
  ) {
    try {
      const { data } = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['country', 'date'],
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'country',
                  expression: countryCode,
                },
              ],
            },
          ],
        },
      });

      return data;
    } catch (error) {
      this.logger.error(error.message);
      throw new ForbiddenException(error.message);
    }
  }

  private formatGetByCountry(
    rawData: searchconsole_v1.Schema$SearchAnalyticsQueryResponse,
  ) {
    const { rows } = rawData;

    const formattedData = rows
      .map((item) => ({
        date: item.keys[1],
        clicks: item.clicks,
        impressions: item.impressions,
        ctr_percent: roundNumber<number>(item.ctr * 100),
        average_position: roundNumber<number>(item.position),
      }))
      .sort((a, b) => compareAsc(new Date(a.date), new Date(b.date)));

    return formattedData;
  }

  async getByCountry(dto: GetByCountryDto, country: string, clientId: string) {
    const { searchConsole, siteUrl } =
      await this.getGoogleSearchConsole(clientId);

    const countryCode: string | null = this.getCountryCode(country);
    if (!countryCode) {
      throw new BadRequestException('invalid country! need more specific name');
    }

    const rawData = await this.fetchGetByCountry(
      searchConsole,
      siteUrl,
      dto.start_date,
      dto.end_date,
      countryCode,
    );

    // Case when data not found
    const hasData = rawData?.rows?.length > 0;
    if (!hasData) return [] as string[];

    const formattedData = this.formatGetByCountry(rawData);

    return formattedData;
  }

  async getAllProperties(clientId: string): Promise<GoogleSearchConsole[]> {
    const { data: oauth2Client, error } =
      await this.googleOauthService.getOauth2Client(
        this.SERVICE_NAME,
        clientId,
      );
    if (error) {
      throw new NotFoundException(error);
    }

    const searchConsole = google.searchconsole({
      version: 'v1',
      auth: oauth2Client,
    });

    const sitesResponse = await searchConsole.sites.list();

    if (
      !sitesResponse.data.siteEntry ||
      sitesResponse.data.siteEntry.length === 0
    ) {
      return [] as GoogleSearchConsole[];
    }

    const formattedProperties = sitesResponse.data.siteEntry.map((site) => {
      const { siteUrl } = site || {};
      const propertyType = siteUrl?.startsWith('sc-domain:')
        ? PropertyType.DOMAIN
        : PropertyType.URL_PREFIX;

      const propertyName =
        propertyType === PropertyType.DOMAIN
          ? siteUrl.replace('sc-domain:', '')
          : siteUrl;

      return {
        property_type: propertyType,
        property_name: propertyName,
      };
    });

    return formattedProperties;
  }
}
