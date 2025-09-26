import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './global/global.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const configService = app.get(ConfigService);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      // whitelist: true,
      transform: true,
    }),
  );

  const env = configService.getOrThrow<string>('ENV');
  const port: string =
    env === 'dev'
      ? configService.getOrThrow('PORT_DEV')
      : configService.getOrThrow('PORT_PROD');

  const config = new DocumentBuilder()
    .setTitle('AI Powered Growth Analyst')
    .setDescription('API documentation for AI Powered Growth Analyst')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documentFactory);

  await app.listen(port);
}
void bootstrap();
