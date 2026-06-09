import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // nginx 등 1단 리버스 프록시를 신뢰 → req.ip 가 X-Forwarded-For 의 실제
  // 클라이언트 IP를 반영해 레이트리밋이 사용자별로 동작한다.
  app.set('trust proxy', 1);

  const origin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) ?? true;
  app.enableCors({ origin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`On-Quest API is running on http://localhost:${port}/api`);
}

void bootstrap();
