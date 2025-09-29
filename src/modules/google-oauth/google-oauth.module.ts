import { Module } from '@nestjs/common';
import { GoogleOauthService } from './google-oauth.service';
import { GoogleOauthController } from './google-oauth.controller';
import { GoogleOauthRepository } from './google-oauth.repository';
import { CosmosModule } from '../cosmos/cosmos.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [CosmosModule, RedisModule],
  controllers: [GoogleOauthController],
  providers: [GoogleOauthService, GoogleOauthRepository],
  exports: [GoogleOauthService],
})
export class GoogleOauthModule {}
