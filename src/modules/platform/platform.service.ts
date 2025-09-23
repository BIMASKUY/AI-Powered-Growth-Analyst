import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UpsertDto } from './dto/upsert.dto';
import { OAuth2Client, OAuth2ClientOptions } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
// import { RedisService } from '../common/service/redis.service';
import { PlatformRepository } from './platform.repository';
import { PlatformEntity } from './entities/platform.entity';
import { GoogleOauthService } from '../google-oauth/google-oauth.service';
import { GoogleAnalyticsService } from '../google-analytics/google-analytics.service';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);
  private readonly oauth2ClientSchema: OAuth2ClientOptions;

  constructor(
    private readonly configService: ConfigService,
    // private readonly redisService: RedisService,
    private readonly platformRepository: PlatformRepository,
    private readonly googleOauthService: GoogleOauthService,
    private readonly googleAnalyticsService: GoogleAnalyticsService,
  ) {
    const env = this.configService.getOrThrow('ENV');
    const isDevelopment = env === 'dev';
    const redirectUri = isDevelopment
      ? this.configService.getOrThrow('GOOGLE_REDIRECT_URI_FE_DEV')
      : this.configService.getOrThrow('GOOGLE_REDIRECT_URI_FE_PROD');

    this.oauth2ClientSchema = {
      clientId: this.configService.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
      redirectUri,
    };
  }

  private async getGoogleOauth(userId: string) {
    try {
      const googleOauth = await this.googleOauthService.getByUserId(userId);
      return {
        data: googleOauth,
        error: null,
      };
    } catch (error) {
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
      const [currentPropertyId, allPropertyIds] = await Promise.all([
        this.googleAnalyticsService.getCurrentProperty(clientId),
        this.googleAnalyticsService.getAllPropertyIds(clientId),
      ]);

      return {
        connected: true,
        current: currentPropertyId,
        options: allPropertyIds,
      };
    } catch (error) {
      return {
        connected: false,
        current: {
          property_id: '',
          property_name: '',
        },
        options: [] as { property_id: string; property_name: string }[],
      };
    }
  }

  // private async getGoogleSearchConsole(clientId: string){

  private async getConnectedPlatforms(userId: string) {
    const googleAnalytics = await this.getGoogleAnalytics(userId);

    return {
      googleAnalytics,
    };
  }

  async getByUserId(userId: string) {
    const { error: googleOauthNotFound } = await this.getGoogleOauth(userId);
    if (googleOauthNotFound) {
      throw new NotFoundException(googleOauthNotFound);
    }

    const platform = await this.platformRepository.getByUserId(userId);

    const { googleAnalytics } = await this.getConnectedPlatforms(userId);

    return {
      google_analytics: googleAnalytics,
    };
  }
}
