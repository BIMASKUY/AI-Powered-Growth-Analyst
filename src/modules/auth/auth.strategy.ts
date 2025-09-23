import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Payload } from './auth.type';

@Injectable()
export class AuthStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(AuthStrategy.name);

  constructor(configService: ConfigService) {
    // not use "private readonly xxx" because it's not stored in class property
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: Payload) {
    this.logger.log(`current user id: ${payload.id}`);
    return {
      id: payload.id,
    };
  }
}
