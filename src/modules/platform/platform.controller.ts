import { Controller, Get, Body, UseGuards, Put } from '@nestjs/common';
import { PlatformService } from './platform.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Auth } from '../auth/auth.decorator';
import { AuthUser } from '../auth/auth.type';
import { UpsertDto } from './dto/upsert.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@ApiTags('Platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @ApiOperation({ summary: 'Upsert platform' })
  @Put()
  async upsert(@Auth() user: AuthUser, @Body() dto: UpsertDto) {
    const data = await this.platformService.upsert(dto, user.id);
    const message = 'platform upserted successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Get platform' })
  @Get()
  async getByUserId(@Auth() user: AuthUser) {
    const data = await this.platformService.getByUserId(user.id);
    const message = 'platform retrieved successfully';
    return {
      message,
      data,
    };
  }
}
