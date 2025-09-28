import { Module } from '@nestjs/common';
import { GoogleSearchConsoleService } from './google-search-console.service';
import { GoogleSearchConsoleController } from './google-search-console.controller';
import { GoogleOauthModule } from '../google-oauth/google-oauth.module';
import { GoogleSearchConsoleRepository } from './google-search-console.repository';
import { CosmosModule } from '../cosmos/cosmos.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [GoogleOauthModule, CosmosModule, RedisModule],
  controllers: [GoogleSearchConsoleController],
  providers: [GoogleSearchConsoleService, GoogleSearchConsoleRepository],
  exports: [GoogleSearchConsoleService, GoogleSearchConsoleRepository],
})
export class GoogleSearchConsoleModule {}
