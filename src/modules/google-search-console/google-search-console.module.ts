import { Module } from '@nestjs/common';
import { GoogleSearchConsoleService } from './google-search-console.service';
import { GoogleSearchConsoleController } from './google-search-console.controller';
import { GoogleOauthModule } from '../google-oauth/google-oauth.module';
import { GoogleSearchConsoleRepository } from './google-search-console.repository';
import { CosmosModule } from '../cosmos/cosmos.module';

@Module({
  imports: [GoogleOauthModule, CosmosModule],
  controllers: [GoogleSearchConsoleController],
  providers: [GoogleSearchConsoleService, GoogleSearchConsoleRepository],
  exports: [GoogleSearchConsoleService, GoogleSearchConsoleRepository],
})
export class GoogleSearchConsoleModule {}
