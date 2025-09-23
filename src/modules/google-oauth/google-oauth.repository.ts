import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { CosmosService } from '../cosmos/cosmos.service';
import { Credentials } from 'google-auth-library';
import { Container } from '@azure/cosmos';
import { GoogleOauthEntity } from './entities/google-oauth.entity';

@Injectable()
export class GoogleOauthRepository implements OnModuleInit {
  private readonly containerId = 'google_oauth';
  private readonly logger = new Logger(GoogleOauthRepository.name);
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

  async create(token: Credentials, userId: string): Promise<GoogleOauthEntity> {
    const data = {
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      scope: token.scope,
      expiry_date: token.expiry_date,
      user_id: userId,
    };

    const { resource } = await this.currentContainer.items.create(data);
    return {
      id: resource.id,
      access_token: resource.access_token,
      refresh_token: resource.refresh_token,
      scope: resource.scope,
      expiry_date: resource.expiry_date,
    };
  }

  async getByUserId(userId: string): Promise<GoogleOauthEntity | null> {
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
      .query<GoogleOauthEntity>(querySpec)
      .fetchAll();
    if (resources.length === 0) return null;

    const resource = resources[0];
    return {
      id: resource.id,
      access_token: resource.access_token,
      refresh_token: resource.refresh_token,
      scope: resource.scope,
      expiry_date: resource.expiry_date,
    };
  }

  async deleteByUserId(userId: string): Promise<void> {
    const { id } = await this.getByUserId(userId);
    await this.currentContainer.item(id).delete();
  }
}
