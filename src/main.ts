import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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
