import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateDto } from './dto/create.dto';
import {
  Credentials,
  OAuth2Client,
  OAuth2ClientOptions,
} from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
// import { RedisService } from '../common/service/redis.service';
import { GoogleOauthRepository } from './google-oauth.repository';
import { GoogleOauthEntity } from './entities/google-oauth.entity';
import { Platform, Scope } from './google-oauth.enum';
import { Result } from '../../global/global.type';
import { GoogleOauth, UserInfo } from './google-oauth.type';

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);
  private readonly oauth2ClientSchema: OAuth2ClientOptions;

  constructor(
    private readonly configService: ConfigService,
    // private readonly redisService: RedisService,
    private readonly googleOauthRepository: GoogleOauthRepository,
  ) {
    const env = this.configService.getOrThrow<string>('ENV');
    const isDevelopment = env === 'dev';
    const redirectUri = isDevelopment
      ? this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI_FE_DEV')
      : this.configService.getOrThrow<string>('GOOGLE_REDIRECT_URI_FE_PROD');

    this.oauth2ClientSchema = {
      clientId: this.configService.getOrThrow('GOOGLE_CLIENT_ID'),
      clientSecret: this.configService.getOrThrow('GOOGLE_CLIENT_SECRET'),
      redirectUri,
    };
  }

  private async getTokenByCode(code: string): Promise<Result<Credentials>> {
    try {
      const oauth2Client = new OAuth2Client(this.oauth2ClientSchema);
      const { tokens } = await oauth2Client.getToken(code);

      return {
        data: tokens,
        error: null,
      };
    } catch (error) {
      this.logger.error(error);
      return {
        data: null,
        error: 'invalid credentials',
      };
    }
  }

  // private async resetGoogle(userId: string): Promise<void> {
  //   const { error } = await this.supabaseService
  //     .getClient()
  //     .rpc('reset_google_services', {
  //       client_id_param: userId,
  //     });
  //
  //   if (error) {
  //     Logger.error(
  //       `Failed to reset Google services: ${error.message}`,
  //       'GoogleOauthService',
  //     );
  //     throw new HttpException('Failed to reset Google services', 500);
  //   }
  // }

  async create(dto: CreateDto, userId: string): Promise<GoogleOauthEntity> {
    const googleOauthExists =
      await this.googleOauthRepository.getByUserId(userId);

    if (googleOauthExists) {
      throw new ConflictException('google oauth already exists');
    }

    const { data: token, error: invalidCode } = await this.getTokenByCode(
      dto.code,
    );
    if (invalidCode) {
      throw new BadRequestException(invalidCode);
    }

    const googleOauth = await this.googleOauthRepository.create(token, userId);
    return googleOauth;
  }

  async getByUserId(userId: string): Promise<GoogleOauth> {
    const googleOauth = await this.googleOauthRepository.getByUserId(userId);
    if (!googleOauth) throw new NotFoundException('google oauth not found');

    const { email, name, image_url } = await this.getUserInfo(googleOauth);

    const arrayScope = googleOauth.scope.split(' ');
    const expiryDate = new Date(googleOauth.expiry_date);

    return {
      access_token: googleOauth.access_token,
      refresh_token: googleOauth.refresh_token,
      scope: arrayScope,
      expiry_date: expiryDate,
      email,
      name,
      image_url,
    };
  }

  private async getUserInfo(googleOauth: GoogleOauthEntity): Promise<UserInfo> {
    const { access_token, refresh_token, expiry_date } = googleOauth;

    const oauth2Client = new OAuth2Client(this.oauth2ClientSchema);
    oauth2Client.setCredentials({
      access_token,
      refresh_token,
      expiry_date,
    });

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });

    const userInfo = await oauth2.userinfo.get();
    const { email, name, picture } = userInfo.data;

    return {
      email,
      name,
      image_url: picture,
    };
  }

  async delete(userId: string): Promise<null> {
    const googleOauth = await this.googleOauthRepository.getByUserId(userId);
    if (!googleOauth) throw new NotFoundException('google oauth not found');

    await Promise.all([
      this.googleOauthRepository.deleteByUserId(userId),
      // this.resetGoogle(userId),
    ]);

    // Reset redis cache for this client
    // await this.redisService.delete(userId);

    return null;
  }

  private getScopeFromPlatform(platform: Platform): Scope {
    switch (platform) {
      case Platform.GOOGLE_ANALYTICS:
        return Scope.GOOGLE_ANALYTICS;
      case Platform.GOOGLE_SEARCH_CONSOLE:
        return Scope.GOOGLE_SEARCH_CONSOLE;
      case Platform.GOOGLE_ADS:
        return Scope.GOOGLE_ADS;
    }
  }

  async getOauth2Client(
    platform: Platform,
    clientId: string,
  ): Promise<Result<OAuth2Client>> {
    const googleOauth = await this.googleOauthRepository.getByUserId(clientId);
    if (!googleOauth) {
      return {
        data: null,
        error: 'google oauth not found',
      };
    }

    const scope = this.getScopeFromPlatform(platform);

    const scopeArray = googleOauth.scope.trim().split(' ');
    const hasScope = scopeArray.includes(scope);
    if (!hasScope) {
      return {
        data: null,
        error: `${platform} scope is required on google oauth`,
      };
    }

    const oauth2Client = new OAuth2Client(this.oauth2ClientSchema);

    oauth2Client.setCredentials({
      access_token: googleOauth.access_token,
      refresh_token: googleOauth.refresh_token,
      expiry_date: googleOauth.expiry_date,
    });

    return {
      data: oauth2Client,
      error: null,
    };
  }
}
