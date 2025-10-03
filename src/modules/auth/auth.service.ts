import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MicrosoftGraphUser, MicrosoftOAuth } from './auth.type';
import { JwtService } from '@nestjs/jwt';
import { Result } from '../../global/global.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly CLIENT_ID: string;
  private readonly CLIENT_SECRET: string;
  private readonly TENANT_ID: string;
  private readonly REDIRECT_URI: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly jwtService: JwtService,
  ) {
    const env = this.configService.getOrThrow<string>('ENV');
    const isDevelopment = env === 'dev';

    this.CLIENT_ID = this.configService.getOrThrow<string>(
      'MICROSOFT_CLIENT_ID',
    );
    this.CLIENT_SECRET = this.configService.getOrThrow<string>(
      'MICROSOFT_CLIENT_SECRET',
    );
    this.TENANT_ID = this.configService.getOrThrow<string>(
      'MICROSOFT_TENANT_ID',
    );
    this.REDIRECT_URI = isDevelopment
      ? this.configService.getOrThrow<string>('MICROSOFT_REDIRECT_URI_FE_DEV')
      : this.configService.getOrThrow<string>('MICROSOFT_REDIRECT_URI_FE_PROD');
  }

  private async getAccessTokenByCode(code: string): Promise<Result<string>> {
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.CLIENT_ID,
        client_secret: this.CLIENT_SECRET,
        code,
        redirect_uri: this.REDIRECT_URI,
      });

      const tokenEndpoint = `https://login.microsoftonline.com/${this.TENANT_ID}/oauth2/v2.0/token`;

      const { data } = await firstValueFrom(
        this.httpService.post<MicrosoftOAuth>(
          tokenEndpoint,
          tokenParams.toString(),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      this.logger.log('Access token obtained successfully');

      return {
        data: data.access_token,
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

  private async getUserId(accessToken: string): Promise<Result<string>> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<MicrosoftGraphUser>(
          'https://graph.microsoft.com/v1.0/me',
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        ),
      );

      return {
        data: data.id,
        error: null,
      };
    } catch (error) {
      this.logger.error(error);

      return {
        data: null,
        error: 'invalid access token',
      };
    }
  }

  private generateJwtToken(userId: string) {
    const payload = { id: userId };
    const token = this.jwtService.sign(payload);
    return token;
  }

  async login(dto: LoginDto) {
    const { data: accessToken, error: invalidCode } =
      await this.getAccessTokenByCode(dto.code);
    if (invalidCode) throw new BadRequestException(invalidCode);

    const { data: userId, error: invalidToken } =
      await this.getUserId(accessToken);
    if (invalidToken) throw new BadRequestException(invalidToken);

    const jwtToken = this.generateJwtToken(userId);

    return {
      user_id: userId,
      token: jwtToken,
    };
  }
}
