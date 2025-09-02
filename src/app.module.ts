import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { GoogleAnalyticsModule } from './modules/google-analytics/google-analytics.module';
import { GoogleAdsModule } from './modules/google-ads/google-ads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GoogleAnalyticsModule,
    GoogleAdsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
