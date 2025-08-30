import { Module } from '@nestjs/common';
import { GoogleAnalyticsService } from './google-analytics.service';
import { GoogleAnalyticsController } from './google-analytics.controller';

@Module({
  imports: [],
  controllers: [GoogleAnalyticsController],
  providers: [GoogleAnalyticsService],
  exports: [GoogleAnalyticsService],
})
export class GoogleAnalyticsModule {}
