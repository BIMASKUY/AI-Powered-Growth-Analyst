import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';
import { Container } from '@azure/cosmos';
import { PlatformEntity } from '../platform/entities/platform.entity';
import { GoogleSearchConsole } from './entities/google-search-console.entity';

@Injectable()
export class GoogleSearchConsoleRepository implements OnModuleInit {
  private readonly containerId = 'platform';
  private readonly logger = new Logger(GoogleSearchConsoleRepository.name);
  private currentContainer: Container;

  constructor(private readonly cosmosService: CosmosService) {}

  async onModuleInit() {
    const { statusCode } = await this.cosmosService
      .getDatabase()
      .containers.createIfNotExists({ id: this.containerId });
    if (statusCode == 201)
      this.logger.warn(
        `creating container "${this.containerId}" as it did not exist.`,
      );
    else this.logger.log('container exists');

    this.currentContainer = this.cosmosService
      .getDatabase()
      .container(this.containerId);
  }

  async getProperty(userId: string): Promise<GoogleSearchConsole | null> {
    const querySpec = {
      query: 'SELECT TOP 1 * FROM c WHERE c.user_id = @userId',
      parameters: [
        {
          name: '@userId',
          value: userId,
        },
      ],
    };

    const { resources } = await this.currentContainer.items
      .query<PlatformEntity>(querySpec)
      .fetchAll();
    if (resources.length === 0) return null;

    const resource = resources[0];
    return {
      property_type: resource.platforms.google_search_console.property_type,
      property_name: resource.platforms.google_search_console.property_name,
    };
  }
}
