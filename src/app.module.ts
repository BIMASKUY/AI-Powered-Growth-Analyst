import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule } from '@nestjs/config';
import { GoogleAnalyticsModule } from './modules/google-analytics/google-analytics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    GoogleAnalyticsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
