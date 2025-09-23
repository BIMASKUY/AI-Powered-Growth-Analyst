import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';
import { Container } from '@azure/cosmos';
import { PlatformEntity } from './entities/platform.entity';
import { UpsertDto } from './dto/upsert.dto';

@Injectable()
export class PlatformRepository implements OnModuleInit {
  private readonly containerId = 'platform';
  private readonly logger = new Logger(PlatformRepository.name);
  private currentContainer: Container;

  constructor(private readonly cosmosService: CosmosService) {}

  async onModuleInit() {
    const { statusCode } = await this.cosmosService
      .getDatabase()
      .containers.createIfNotExists({ id: this.containerId });
    if (statusCode == 201)
      this.logger.warn(
        `Creating container "${this.containerId}" as it did not exist.`,
      );
    else this.logger.log('Container exists');

    this.currentContainer = this.cosmosService
      .getDatabase()
      .container(this.containerId);
  }

  async upsert(dto: UpsertDto, userId: string) {
    const data = {
      id: userId, // use userId as the id to ensure one-to-one relationship
      platforms: {
        ...dto,
      },
      user_id: userId,
    };

    const { resource } =
      await this.currentContainer.items.upsert<PlatformEntity>(data);
    const { platforms } = resource;
    const { google_analytics, google_search_console, google_ads } = platforms;

    return {
      id: resource.id,
      platforms: {
        google_analytics: {
          property_id: google_analytics.property_id,
        },
        google_search_console: {
          property_type: google_search_console.property_type,
          property: google_search_console.property,
        },
        google_ads: {
          manager_account_developer_token:
            google_ads.manager_account_developer_token,
          customer_account_id: google_ads.customer_account_id,
        },
      },
      user_id: resource.user_id,
    };
  }

  private formatGetByUserId(resource: PlatformEntity | null) {
    const { id, user_id, platforms } = resource || {};
    const { google_analytics, google_search_console, google_ads } =
      platforms || {};
    const { property_id } = google_analytics || {};
    const { property_type, property } = google_search_console || {};
    const { manager_account_developer_token, customer_account_id } =
      google_ads || {};

    return {
      id: id || '',
      platforms: {
        google_analytics: {
          property_id: property_id || '',
        },
        google_search_console: {
          property_type: property_type || '',
          property: property || '',
        },
        google_ads: {
          manager_account_developer_token:
            manager_account_developer_token || '',
          customer_account_id: customer_account_id || '',
        },
      },
      user_id: user_id || '',
    };
  }

  async getByUserId(userId: string): Promise<PlatformEntity> {
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

    const resource = resources.length > 0 ? resources[0] : null;

    const formattedResource = this.formatGetByUserId(resource);
    return formattedResource;
  }
}
