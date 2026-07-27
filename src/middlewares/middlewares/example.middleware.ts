import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class ExampleMiddleware implements NestMiddleware {
  constructor() {
    console.log('ExampleMiddleware is called');
  }
  async use(_req: Request, _res: Response, next: NextFunction) {
    next();
  }
}
