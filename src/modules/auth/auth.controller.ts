import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from './auth.guard';
import { Auth } from './auth.decorator';
import { AuthUser } from './auth.type';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'login with microsoft oauth' })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    const message = 'login successfully';
    return {
      message,
      data,
    };
  }

  @ApiOperation({ summary: 'get profile by token' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('profile')
  getProfile(@Auth() user: AuthUser) {
    return user;
  }
}
