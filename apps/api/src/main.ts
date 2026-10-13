import 'dotenv/config';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './config/app';
import { env } from './config/env';
import { INLINE_IMAGES_DIR, storageRoot } from './utils/private-storage';
import { Logger, } from '@nestjs/common';

async function bootstrap() {
  const config = env(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  // Chỉ thư mục con ảnh chèn được phục vụ công khai (ngoài prefix api/v1);
  // phần còn lại của STORAGE_PATH vẫn là tệp riêng tư, tải qua endpoint có auth.
  app.useStaticAssets(join(storageRoot(), INLINE_IMAGES_DIR), {
    prefix: `/${INLINE_IMAGES_DIR}`,
  });
  app.enableShutdownHooks();

  await app.listen(config.port);
  const logger = new Logger('Main');
  logger.log(`Application is running on: ${await app.getUrl()}`);
}

void bootstrap();
