import { Module } from '@nestjs/common';
import { CosmosService } from './cosmos.service';

@Module({
  imports: [],
  controllers: [],
  providers: [CosmosService],
  exports: [CosmosService],
})
export class CosmosModule {}
