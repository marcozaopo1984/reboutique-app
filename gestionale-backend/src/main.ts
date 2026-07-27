import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function getAllowedFrontendOrigins(): string[] {
  const configuredOrigins =
    process.env.FRONTEND_ORIGINS ??
    'http://localhost:3000,http://127.0.0.1:3000';

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = getAllowedFrontendOrigins();

  app.enableCors({
    origin(origin, callback) {
      // Le richieste server-to-server e gli health check possono non avere Origin.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin non consentita: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  const port = Number.parseInt(process.env.PORT ?? '3001', 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT non valida: ${process.env.PORT}`);
  }

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
