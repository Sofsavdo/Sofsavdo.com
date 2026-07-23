import "reflect-metadata";
import * as path from "path";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { correlationIdMiddleware } from "./common/middleware/correlation-id.middleware";
import { AppLogger } from "./common/logging/app-logger.service";

async function bootstrap() {
  const logger = new AppLogger("Bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // Serves the LocalDiskStorage adapter's files (dev/test only — see storage/local-disk.storage.ts;
  // a real cloud provider would serve from its own CDN and this line would simply not run).
  app.useStaticAssets(path.resolve(process.env.STORAGE_LOCAL_DIR ?? "uploads"), { prefix: "/media/" });
  // AppLogger is transient-scoped (a fresh instance per injection site, so each class's log
  // lines carry its own context) — `app.get()` only works for singleton-scoped providers and
  // throws InvalidClassScopeException for anything else; `app.resolve()` is the scoped-provider
  // equivalent. This was never caught by the e2e test suites because they build their Nest
  // application via `Test.createTestingModule(...).createNestApplication()` and never call this
  // bootstrap() function at all — only actually starting the real server surfaces it.
  app.useLogger(await app.resolve(AppLogger));

  app.use(helmet());
  app.use(cookieParser());
  // Must run as middleware, before Guards — see the comment in correlation-id.middleware.ts.
  app.use(correlationIdMiddleware);
  app.enableCors({
    origin: process.env.WEB_APP_URL ?? "http://localhost:3000",
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Rosti API")
    .setDescription("Creator-affiliate commerce platform — backend contract")
    .setVersion("0.1")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  logger.log(`Rosti API listening on :${port} (docs at /docs)`);
}

void bootstrap();
