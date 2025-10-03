import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { PlatformRepository } from './platform.repository';
import { CosmosModule } from '../cosmos/cosmos.module';
import { GoogleOauthModule } from '../google-oauth/google-oauth.module';
import { GoogleAnalyticsModule } from '../google-analytics/google-analytics.module';
import { GoogleSearchConsoleModule } from '../google-search-console/google-search-console.module';
import { GoogleAdsModule } from '../google-ads/google-ads.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    CosmosModule,
    GoogleOauthModule,
    GoogleAnalyticsModule,
    GoogleSearchConsoleModule,
    GoogleAdsModule,
    RedisModule,
  ],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRepository],
  exports: [PlatformService],
})
export class PlatformModule {}
