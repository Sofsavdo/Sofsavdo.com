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
import { validateEnv } from "./config/env-validation";
import type { ErrorReportingPort } from "./common/error-reporting/error-reporting.port";
import { NoopErrorReportingAdapter } from "./common/error-reporting/noop-error-reporting.adapter";
import { WebhookErrorReportingAdapter } from "./common/error-reporting/webhook-error-reporting.adapter";

// Optional by design: ERROR_REPORTING_WEBHOOK_URL is absent from env-validation.ts's required
// list on purpose — an external error-reporting provider must never be a launch blocker. Unset
// means every 5xx is still logged (AllExceptionsFilter -> AppLogger) but never forwarded anywhere.
function buildErrorReportingAdapter(): ErrorReportingPort {
  const webhookUrl = process.env.ERROR_REPORTING_WEBHOOK_URL;
  return webhookUrl ? new WebhookErrorReportingAdapter(webhookUrl) : new NoopErrorReportingAdapter();
}

// Comma-separated list of allowed browser origins for CORS. Falls back to the single WEB_APP_URL
// (the pre-Phase-14 behavior) so nothing breaks for existing single-origin deployments — this only
// adds the ability to list more than one when it's actually needed (e.g. a staging + production
// web app sharing one API, or a www/non-www pair).
function resolveAllowedOrigins(): string[] {
  const list = process.env.CORS_ALLOWED_ORIGINS;
  if (list && list.trim()) return list.split(",").map((o) => o.trim()).filter(Boolean);
  return [process.env.WEB_APP_URL ?? "http://localhost:3000"];
}

async function bootstrap() {
  // Runs before Nest even starts building the DI graph — a production deploy with a missing
  // secret or a forgeable Click signature fallback must never reach the point of accepting a
  // single request. See env-validation.ts for the full required/optional list and reasoning.
  validateEnv(process.env);

  const logger = new AppLogger("Bootstrap");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Railway (and any reverse-proxy deployment) terminates TLS and forwards requests through a
  // proxy — without this, Express's `req.ip`/`req.secure` reflect the proxy hop, not the real
  // client. That silently breaks two real things: ThrottlerGuard's per-IP rate-limit bucketing
  // (every request would appear to come from the same proxy IP, either rate-limiting everyone
  // together or no one at all) and `PublicCheckoutController`'s IP-hash-based visit tracking. `1`
  // trusts exactly one hop (the platform's own edge proxy), not an arbitrary chain a client could
  // spoof by sending its own X-Forwarded-For.
  app.set("trust proxy", 1);

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
    origin: resolveAllowedOrigins(),
    credentials: true,
  });

  // Explicit, auditable request body size limits — Express's body-parser default (100kb) was
  // previously implicit and unconfirmed; 1mb comfortably covers the largest real JSON payloads
  // this API accepts (Campaign/Content DTOs with several string-array fields) without leaving the
  // limit undocumented. File uploads go through a completely separate pipeline (multer,
  // memoryStorage, its own explicit 100MB `limits.fileSize` — see campaign-media.controller.ts/
  // creator-content.controller.ts) and are unaffected by this.
  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "1mb" });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(buildErrorReportingAdapter()));

  // Swagger exposes the full route/DTO surface of the API — useful for local/staging integration
  // work, not something a production deployment should serve publicly by default. Gated behind
  // NODE_ENV rather than deleted, so staging (NODE_ENV=production is reserved for the real
  // production deploy; a staging environment should set NODE_ENV=production too per standard
  // practice, but can opt back in via SWAGGER_ENABLED=true if a protected staging docs view is
  // genuinely wanted).
  const swaggerEnabled = process.env.NODE_ENV !== "production" || process.env.SWAGGER_ENABLED === "true";
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Rosti API")
      .setDescription("Creator-affiliate commerce platform — backend contract")
      .setVersion("0.1")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("docs", app, document);
  }

  // Lets Nest run each module's onModuleDestroy/onApplicationShutdown hooks on SIGTERM/SIGINT —
  // PrismaService's pool.end() and AnalyticsCacheService's redis.disconnect() only ever ran in
  // the test suites' explicit moduleRef.close() before this; a real deploy's rolling restart sends
  // SIGTERM, and without this call those connections were never drained, just killed.
  app.enableShutdownHooks();

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  logger.log(`Rosti API listening on :${port}${swaggerEnabled ? " (docs at /docs)" : ""}`);
}

void bootstrap();
