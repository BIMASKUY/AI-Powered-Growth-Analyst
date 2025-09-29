import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';
import { Container } from '@azure/cosmos';
import { PlatformEntity } from '../platform/entities/platform.entity';
import { GoogleAds } from './entities/google-ads.entity';

@Injectable()
export class GoogleAdsRepository implements OnModuleInit {
  private readonly containerId = 'platform';
  private readonly logger = new Logger(GoogleAdsRepository.name);
  private currentContainer: Container;

  constructor(private readonly cosmosService: CosmosService) {}

  async onModuleInit(): Promise<void> {
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

  async getAccount(userId: string): Promise<GoogleAds> {
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
      manager_account_developer_token:
        resource.platforms.google_ads.manager_account_developer_token,
      customer_account_id: resource.platforms.google_ads.customer_account_id,
    };
  }
}
