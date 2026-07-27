import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ApiExceptionFilter } from '../filters/api-exception.filter';
import { ApiResponseInterceptor } from '../interceptors/api-response.interceptor';
import { env } from './env';

export function configureApp(app: INestApplication) {
  const { allowedOrigins, trustProxyHops } = env(process.env);

  if (trustProxyHops > 0) {
    const express = app.getHttpAdapter().getInstance() as {
      set(name: string, value: number): void;
    };
    express.set('trust proxy', trustProxyHops);
  }
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Cong An API').setVersion('v1').build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}
