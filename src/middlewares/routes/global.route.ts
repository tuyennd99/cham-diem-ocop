import { MiddlewareConsumer } from '@nestjs/common';
import { ExampleMiddleware } from '../middlewares';

export class GlobalRoutesConfig {
  static configure(consumer: MiddlewareConsumer) {
    this.applyAllRoutes(consumer);
  }

  static applyAllRoutes(consumer: MiddlewareConsumer) {
    consumer.apply(ExampleMiddleware).exclude('/health').exclude('/assets/:fileKey').forRoutes('*api');
  }
}
