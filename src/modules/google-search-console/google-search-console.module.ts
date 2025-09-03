import { Module } from '@nestjs/common';
import { GoogleSearchConsoleService } from './google-search-console.service';
import { GoogleSearchConsoleController } from './google-search-console.controller';
// import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    // CommonModule
  ],
  controllers: [GoogleSearchConsoleController],
  providers: [GoogleSearchConsoleService],
  exports: [GoogleSearchConsoleService],
})
export class GoogleSearchConsoleModule {}
