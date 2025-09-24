import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UpsertDto } from './dto/upsert.dto';
// import { RedisService } from '../common/service/redis.service';
import { PlatformRepository } from './platform.repository';
import { GoogleOauthService } from '../google-oauth/google-oauth.service';
import { GoogleAnalyticsService } from '../google-analytics/google-analytics.service';
import { GoogleAnalytics } from './platform.type';
import { GoogleSearchConsoleService } from '../google-search-console/google-search-console.service';
import { GoogleSearchConsoleRepository } from '../google-search-console/google-search-console.repository';
import { GoogleAds } from './entities/google-ads.entity';
import { GoogleSearchConsole } from './entities/google-search-console.entity';
import { GoogleAdsRepository } from '../google-ads/google-ads.repository';
import { GoogleAdsService } from '../google-ads/google-ads.service';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(
    // private readonly redisService: RedisService,
    private readonly platformRepository: PlatformRepository,
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
    private readonly googleSearchConsoleService: GoogleSearchConsoleService,
    private readonly googleSearchConsoleRepository: GoogleSearchConsoleRepository,
    private readonly googleAdsRepository: GoogleAdsRepository,
    private readonly googleAdsService: GoogleAdsService,
  ) {}

  private async getGoogleOauth(userId: string) {
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

  async upsert(dto: UpsertDto, userId: string) {
    const { error: googleOauthNotFound } = await this.getGoogleOauth(userId);
    if (googleOauthNotFound) {
      throw new NotFoundException(googleOauthNotFound);
    }

    const platform = await this.platformRepository.upsert(dto, userId);
    return platform;
  }

  private async getGoogleAnalytics(clientId: string) {
    try {
      const [currentProperty, allProperties] = await Promise.all([
        this.googleAnalyticsService.getCurrentProperty(clientId),
        this.googleAnalyticsService.getAllProperties(clientId),
      ]);

      return {
        connected: true,
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
        options: [] as GoogleAnalytics[],
      };
    }
  }

  private async getGoogleSearchConsole(clientId: string) {
    try {
      const [currentProperty, allProperties] = await Promise.all([
        this.googleSearchConsoleRepository.getProperty(clientId),
        this.googleSearchConsoleService.getAllProperties(clientId),
      ]);

      return {
        connected: true,
        current: currentProperty,
        options: allProperties,
      };
    } catch (error) {
      this.logger.log(error.message);
      return {
        connected: false,
        current: {
          property_type: '',
          property_name: '',
        },
        options: [] as GoogleSearchConsole[],
      };
    }
  }

  private async getGoogleAds(clientId: string) {
    try {
      const currentAccount = await this.googleAdsRepository.getAccount(clientId);
      const allAccounts = await this.googleAdsService.getAllAccountIds(clientId);

      return {
        connected: true,
        current: currentAccount,
        options: allAccounts,
      };
    } catch (error) {
      this.logger.log(error.message);
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

  private async getConnectedPlatforms(userId: string) {
    const [googleAnalytics, googleSearchConsole, googleAds] = await Promise.all([
      this.getGoogleAnalytics(userId),
      this.getGoogleSearchConsole(userId),
      this.getGoogleAds(userId),
    ]);

    return {
      googleAnalytics,
      googleSearchConsole,
      googleAds,
    };
  }

  async getByUserId(userId: string) {
    const { error: googleOauthNotFound } = await this.getGoogleOauth(userId);
    if (googleOauthNotFound) {
      throw new NotFoundException(googleOauthNotFound);
    }

    const { googleAnalytics, googleSearchConsole, googleAds } = await this.getConnectedPlatforms(userId);

    return {
      google_analytics: googleAnalytics,
      google_search_console: googleSearchConsole,
      google_ads: googleAds,
    };
  }
}
