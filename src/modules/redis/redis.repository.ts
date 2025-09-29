import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisRepository implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisRepository.name);
  private readonly ttl: number;
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.getOrThrow<string>(
      'REDIS_CONNECTION_STRING',
    );
    const strTTL = this.configService.getOrThrow<string>('REDIS_TTL_SECONDS');
    this.ttl = parseInt(strTTL);

    // Parse Azure Redis connection
    const parts = connectionString.split(',');
    const hostPort = parts[0];
    const [host, port] = hostPort.split(':');

    // Extract password
    const passwordPart = parts.find((part) => part.startsWith('password='));
    if (!passwordPart) {
      throw new InternalServerErrorException(`invalid password for redis`);
    }
    const password = passwordPart.replace('password=', '');

    // Check SSL
    const sslPart = parts.find((part) => part.startsWith('ssl='));
    const useSSL = sslPart
      ? sslPart.split('=')[1].toLowerCase() === 'true'
      : false;
    const tls = useSSL ? { servername: host } : undefined;

    this.redis = new Redis({
      host,
      port: parseInt(port),
      password,
      tls,
      db: 0,
      connectTimeout: 10000,
      commandTimeout: 5000,
      maxLoadingRetryTime: 10000,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      retryStrategy: (times) => {
        // exponential backoff, max 10s
        return Math.min(times * 200, 10000);
      },
    });

    this.redis.on('connect', () => {
      this.logger.log('redis client connected');
    });

    this.redis.on('ready', () => {
      this.logger.log('redis client ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error('redis client error:', error);
    });

    this.redis.on('close', () => {
      this.logger.warn('redis client connection closed');
    });

    this.redis.on('reconnecting', () => {
      this.logger.log('redis client reconnecting...');
    });
  }

  async onModuleInit() {
    try {
      await this.redis.connect();
      const pong = await this.redis.ping();
      if (pong === 'PONG') {
        this.logger.log('redis connection established successfully');
      }
    } catch (error) {
      this.logger.error('failed to connect to Redis:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.redis.quit();
      this.logger.log('redis connection closed');
    } catch (error) {
      this.logger.error('error closing redis connection:', error);
    }
  }

  async create(key: string, value: string): Promise<void> {
    await this.redis.setex(key, this.ttl, value);
    this.logger.log(`create cache key: ${key}`);
  }

  async get(key: string): Promise<string | null> {
    const value = await this.redis.get(key);
    if (!value) return null;
    this.logger.log(`get cache key: ${key}`);
    return value;
  }

  async delete(key: string): Promise<void> {
    const pattern = `${key}:*`;
    const keys: string[] = [];
    let cursor = '0';

    do {
      const result = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== '0');

    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    this.logger.log(`reset user_id: ${key}`);
  }
}
