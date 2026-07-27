import { ExampleMiddleware } from './../middlewares/example.middleware';
import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';

export class AuthenticationRoutesConfig {
  static configure(consumer: MiddlewareConsumer) {
    this.signup(consumer);
  }

  static signup(consumer: MiddlewareConsumer) {
    consumer.apply(ExampleMiddleware).forRoutes({
      path: '/auth/signup',
      method: RequestMethod.POST,
    });
  }
}
