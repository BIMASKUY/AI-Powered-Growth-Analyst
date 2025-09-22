import { Module } from '@nestjs/common';
import { GoogleAnalyticsService } from './google-analytics.service';
import { GoogleAnalyticsController } from './google-analytics.controller';
import { GoogleOauthModule } from '../google-oauth/google-oauth.module';
import { GoogleAnalyticsRepository } from './google-analytics.repository';
import { CosmosModule } from '../cosmos/cosmos.module';

@Module({
  imports: [GoogleOauthModule, CosmosModule],
  controllers: [GoogleAnalyticsController],
  providers: [GoogleAnalyticsService, GoogleAnalyticsRepository],
  exports: [GoogleAnalyticsService],
})
export class GoogleAnalyticsModule {}
