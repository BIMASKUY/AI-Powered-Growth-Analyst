import { Module } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { PlatformRepository } from './platform.repository';
import { CosmosModule } from '../cosmos/cosmos.module';
import { GoogleOauthModule } from '../google-oauth/google-oauth.module';
import { GoogleAnalyticsModule } from '../google-analytics/google-analytics.module';

@Module({
  imports: [CosmosModule, GoogleOauthModule, GoogleAnalyticsModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformRepository],
  exports: [PlatformService],
})
export class PlatformModule {}
