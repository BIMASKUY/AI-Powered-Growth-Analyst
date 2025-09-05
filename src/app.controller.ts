import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@Controller()
@ApiTags('Home')
export class AppController {
  @Get()
  root(): string {
    return 'API is running! Check /docs for API documentation';
  }
}
