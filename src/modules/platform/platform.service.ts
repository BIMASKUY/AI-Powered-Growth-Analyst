import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UpsertDto } from './dto/upsert.dto';
import { RedisService } from '../redis/redis.service';
import { PlatformRepository } from './platform.repository';
import { GoogleOauthService } from '../google-oauth/google-oauth.service';
import { GoogleAnalyticsService } from '../google-analytics/google-analytics.service';
import { GoogleSearchConsoleService } from '../google-search-console/google-search-console.service';
import { GoogleSearchConsoleRepository } from '../google-search-console/google-search-console.repository';
import { GoogleSearchConsole } from '../google-search-console/entities/google-search-console.entity';
import { GoogleAdsRepository } from '../google-ads/google-ads.repository';
import { GoogleAdsService } from '../google-ads/google-ads.service';
import { Result } from '../../global/global.type';
import { GoogleOauth } from '../google-oauth/google-oauth.type';
import { PlatformEntity } from './entities/platform.entity';
import { Property } from '../google-analytics/google-analytics.type';
import { GoogleAdsPlatform, GoogleAnalyticsPlatform, GoogleSearchConsolePlatform, Platform } from './platform.type';
import { PropertyType } from './platform.enum';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly platformRepository: PlatformRepository,
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
    private readonly googleSearchConsoleService: GoogleSearchConsoleService,
    private readonly googleSearchConsoleRepository: GoogleSearchConsoleRepository,
    private readonly googleAdsRepository: GoogleAdsRepository,
    private readonly googleAdsService: GoogleAdsService,
  ) {}

  private getKeyCache(userId: string) {
    return `user_id=${userId}:platform`;
  }

  private async getGoogleOauth(userId: string): Promise<Result<GoogleOauth>> {
    try {
      const googleOauth = await this.googleOauthService.getByUserId(userId);
      return {
        data: googleOauth,
        error: null,
      };
    } catch (error) {
      this.logger.error(error.massage);
      return {
        data: null,
        error: 'google oauth not found',
      };
    }
  }

  async upsert(dto: UpsertDto, userId: string): Promise<PlatformEntity> {
    const { error: googleOauthNotFound } = await this.getGoogleOauth(userId);
    if (googleOauthNotFound) {
      throw new NotFoundException(googleOauthNotFound);
    }

    const platform = await this.platformRepository.upsert(dto, userId);
    return platform;
  }

  private async getGoogleAnalytics(clientId: string): Promise<GoogleAnalyticsPlatform> {
    try {
      const [currentProperty, allProperties, isConnect] = await Promise.all([
        this.googleAnalyticsService.getCurrentProperty(clientId),
        this.googleAnalyticsService.getAllProperties(clientId),
        this.googleAnalyticsService.isConnected(clientId),
      ]);

      return {
        connected: isConnect,
        current: currentProperty,
        options: allProperties,
      };
    } catch (error) {
      this.logger.error(error);
      return {
        connected: false,
        current: {
          property_id: '',
          property_name: '',
        },
        options: [] as Property[],
      };
    }
  }

  private async getGoogleSearchConsole(clientId: string): Promise<GoogleSearchConsolePlatform> {
    try {
      const [currentProperty, allProperties, isConnect] = await Promise.all([
        this.googleSearchConsoleRepository.getProperty(clientId),
        this.googleSearchConsoleService.getAllProperties(clientId),
        this.googleSearchConsoleService.isConnected(clientId),
      ]);

      return {
        connected: isConnect,
        current: currentProperty,
        options: allProperties,
      };
    } catch (error) {
      this.logger.log(error);
      return {
        connected: false,
        current: {
          property_type: PropertyType.NOT_SET,
          property_name: '',
        },
        options: [] as GoogleSearchConsole[],
      };
    }
  }

  private async getGoogleAds(clientId: string): Promise<GoogleAdsPlatform> {
    try {
      const [currentAccount, allAccounts, isConnect] = await Promise.all([
        this.googleAdsRepository.getAccount(clientId),
        this.googleAdsService.getAllAccountIds(clientId),
        this.googleAdsService.isConnected(clientId),
      ]);

      return {
        connected: isConnect,
        current: currentAccount,
        options: allAccounts,
      };
    } catch (error) {
      this.logger.log(error);
      return {
        connected: false,
        current: {
          customer_account_id: '',
          manager_account_developer_token: '',
        },
        options: [] as string[],
      };
    }
  }

  async getByUserId(userId: string): Promise<Platform> {
    // get cache
    const keyCache = this.getKeyCache(userId);
    const cache = await this.redisService.getPlatform<Platform>(keyCache);
    if (cache) return cache;

    const { error: googleOauthNotFound } = await this.getGoogleOauth(userId);
    if (googleOauthNotFound) {
      throw new NotFoundException(googleOauthNotFound);
    }

    const [googleAnalytics, googleSearchConsole, googleAds] = await Promise.all([
      this.getGoogleAnalytics(userId),
      this.getGoogleSearchConsole(userId),
      this.getGoogleAds(userId),
    ]);

    // create cache
    await this.redisService.createPlatform<Platform>(keyCache, {
      google_analytics: googleAnalytics,
      google_search_console: googleSearchConsole,
      google_ads: googleAds,
    });

    return {
      google_analytics: googleAnalytics,
      google_search_console: googleSearchConsole,
      google_ads: googleAds,
    };
  }
}
