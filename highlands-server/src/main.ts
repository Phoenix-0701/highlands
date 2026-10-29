import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DatabaseErrorFilter } from './database-error.filter';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function bootstrap() {
  const rootEnv = resolve(process.cwd(), '..', '.env');
  const envFile = existsSync(rootEnv)
    ? rootEnv
    : resolve(process.cwd(), '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
  });
  app.useGlobalFilters(new DatabaseErrorFilter());
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3001, '127.0.0.1');
}
void bootstrap();
