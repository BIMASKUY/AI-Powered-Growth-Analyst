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
  private client: Redis;

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

    this.client = new Redis({
      host,
      port: parseInt(port),
      password,
      tls: useSSL ? {} : undefined,
      maxLoadingRetryTime: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.logger.log('Redis client connected');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis client ready');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error:', error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis client connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.log('Redis client reconnecting...');
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      const pong = await this.client.ping();
      if (pong === 'PONG') {
        this.logger.log('Redis connection established successfully');
      }
    } catch (error) {
      this.logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }

  async create(key: string, value: string): Promise<void> {
    await this.client.setex(key, this.ttl, value);
    this.logger.log(`written key: ${key}`);
  }

  async get(key: string): Promise<string | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    return value;
  }

  // async delete(key: string): Promise<number> {
  //   try {
  //     const result = await this.client.del(key);
  //     this.logger.debug(`Deleted key: ${key}`);
  //     return result;
  //   } catch (error) {
  //     this.logger.error(`Failed to delete key ${key}:`, error);
  //     throw error;
  //   }
  // }
}
