import { Controller, Get, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { GoogleOauthService } from './google-oauth.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { Auth } from '../auth/auth.decorator';
import { AuthUser } from '../auth/auth.type';
import { CreateDto } from './dto/create.dto';

@ApiBearerAuth()
@UseGuards(AuthGuard)
@ApiTags('Google OAuth')
@Controller('google-oauth')
export class GoogleOauthController {
  constructor(private readonly googleOauthService: GoogleOauthService) {}

  @ApiOperation({ summary: 'Create google oauth token' })
  @Post()
  async create(@Auth() user: AuthUser, @Body() dto: CreateDto) {
    const data = await this.googleOauthService.create(
      dto,
      user.id,
    );
    const message = 'google oauth token created successfully';
    return {
      message,
      data,
    }
  }

  @ApiOperation({ summary: 'Get google oauth token' })
  @Get()
  async getByUserId(@Auth() user: AuthUser) {
    const data = await this.googleOauthService.getByUserId(user.id);
    const message = 'google oauth token retrieved successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'Delete google oauth token' })
  @Delete()
  async delete(@Auth() user: AuthUser) {
    const data = await this.googleOauthService.delete(
      user.id,
    );
    const message = 'google oauth token deleted successfully';
    return {
      message,
      data,
    }
  }
}
