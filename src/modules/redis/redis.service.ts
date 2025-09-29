import { Injectable, Logger } from '@nestjs/common';
import { RedisRepository } from './redis.repository';
import { AdvancedServiceKey, ParamServiceKey, ServiceKey } from './redis.type';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);

  constructor(private readonly redisRepository: RedisRepository) {}

  private formatKey(key: ServiceKey): string {
    const userId = `user_id=${key.user_id}`;
    const service = `service=${key.service}`;
    const method = `method=${key.method}`;
    const startDate = `start_date=${key.start_date}`;
    const endDate = `end_date=${key.end_date}`;

    return `${userId}:${service}:${method}:${startDate}:${endDate}`;
  }

  private advancedFormatKey(key: AdvancedServiceKey): string {
    const baseKey = this.formatKey(key);
    const limit = `limit=${key.limit}`;
    const search = `search=${key.search}`;

    return `${baseKey}:${limit}:${search}`;
  }

  private paramFormatKey(key: ParamServiceKey): string {
    const baseKey = this.formatKey(key);
    const param = `param=${key.param}`;

    return `${baseKey}:${param}`;
  }

  private formatValueToString<T>(value: T): string {
    return JSON.stringify(value);
  }

  private formatValueToJson<T>(value: string): T {
    return JSON.parse(value) as T;
  }

  async createService<T>(key: ServiceKey, value: T): Promise<void> {
    const formattedKey = this.formatKey(key);
    const formattedValue = this.formatValueToString<T>(value);
    await this.redisRepository.create(formattedKey, formattedValue);
  }

  async createAdvancedService<T>(
    key: AdvancedServiceKey,
    value: T,
  ): Promise<void> {
    const formattedKey = this.advancedFormatKey(key);
    const formattedValue = this.formatValueToString<T>(value);
    await this.redisRepository.create(formattedKey, formattedValue);
  }

  async createParamService<T>(key: ParamServiceKey, value: T): Promise<void> {
    const formattedKey = this.paramFormatKey(key);
    const formattedValue = this.formatValueToString<T>(value);
    await this.redisRepository.create(formattedKey, formattedValue);
  }

  async createPlatform<T>(key: string, value: T): Promise<void> {
    const formattedValue = this.formatValueToString<T>(value);
    await this.redisRepository.create(key, formattedValue);
  }

  async getService<T>(key: ServiceKey): Promise<T | null> {
    const formattedKey = this.formatKey(key);
    const value = await this.redisRepository.get(formattedKey);
    if (!value) return null;

    const formattedValue = this.formatValueToJson<T>(value);
    return formattedValue;
  }

  async getAdvancedService<T>(key: AdvancedServiceKey): Promise<T | null> {
    const formattedKey = this.advancedFormatKey(key);
    const value = await this.redisRepository.get(formattedKey);
    if (!value) return null;

    const formattedValue = this.formatValueToJson<T>(value);
    return formattedValue;
  }

  async getParamService<T>(key: ParamServiceKey): Promise<T | null> {
    const formattedKey = this.paramFormatKey(key);
    const value = await this.redisRepository.get(formattedKey);
    if (!value) return null;

    const formattedValue = this.formatValueToJson<T>(value);
    return formattedValue;
  }

  async getPlatform<T>(key: string): Promise<T | null> {
    const value = await this.redisRepository.get(key);
    if (!value) return null;

    const formattedValue = this.formatValueToJson<T>(value);
    return formattedValue;
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
