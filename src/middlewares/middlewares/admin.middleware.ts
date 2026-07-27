import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class AdminMiddleware implements NestMiddleware {
  constructor() {}
  async use(_req: Request, _res: Response, next: NextFunction) {
    next();
  }
}
