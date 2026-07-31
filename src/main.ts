import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/app';
import { env } from './config/env';
import { Logger, } from '@nestjs/common';

async function bootstrap() {
  const config = env(process.env);
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(config.port);
  const logger = new Logger('Main');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
