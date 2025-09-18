import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CosmosClient } from '@azure/cosmos';

@Injectable()
export class CosmosService implements OnModuleInit {
  private readonly logger = new Logger(CosmosService.name);
  private readonly client: CosmosClient;
  private readonly databaseId: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.getOrThrow<string>('COSMOS_DB_ENDPOINT');
    const key = this.configService.getOrThrow<string>('COSMOS_DB_KEY');
    this.client = new CosmosClient({ endpoint, key });
    this.databaseId = this.configService.getOrThrow<string>('COSMOS_DB_DATABASE_ID');
  }

  async onModuleInit() {
    const { statusCode } = await this.client.databases.createIfNotExists({ id: this.databaseId });
    if (statusCode == 201) this.logger.warn(`Creating database "${this.databaseId}" as it did not exist.`);
    else this.logger.log('Database exists')
  }

  getDatabase() {
    return this.client.database(this.databaseId);
  }
}