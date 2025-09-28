import { Module } from '@nestjs/common';
import { GoogleAdsService } from './google-ads.service';
import { GoogleAdsController } from './google-ads.controller';
import { GoogleOauthModule } from '../google-oauth/google-oauth.module';
import { GoogleAdsRepository } from './google-ads.repository';
import { CosmosModule } from '../cosmos/cosmos.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [GoogleOauthModule, CosmosModule, RedisModule],
  controllers: [GoogleAdsController],
  providers: [GoogleAdsService, GoogleAdsRepository],
  exports: [GoogleAdsService, GoogleAdsRepository],
})
export class GoogleAdsModule {}
