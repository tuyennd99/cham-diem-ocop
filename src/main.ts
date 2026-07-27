import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './config/app';
import { env } from './config/env';

async function bootstrap() {
  const config = env(process.env);
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  await app.listen(config.port);
}

void bootstrap();
