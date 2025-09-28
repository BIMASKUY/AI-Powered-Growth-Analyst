import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisRepository } from './redis.repository';

@Module({
  imports: [],
  controllers: [],
  providers: [RedisService, RedisRepository],
  exports: [RedisService],
})
export class RedisModule {}
