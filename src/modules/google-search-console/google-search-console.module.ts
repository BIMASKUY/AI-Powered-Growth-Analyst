import { Module } from '@nestjs/common';
import { GoogleSearchConsoleService } from './google-search-console.service';
import { GoogleSearchConsoleController } from './google-search-console.controller';

@Module({
  imports: [],
  controllers: [GoogleSearchConsoleController],
  providers: [GoogleSearchConsoleService],
  exports: [GoogleSearchConsoleService],
})
export class GoogleSearchConsoleModule {}
