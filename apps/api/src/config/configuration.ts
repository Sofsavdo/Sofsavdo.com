export interface AppConfig {
  nodeEnv: string;
  port: number;
  webAppUrl: string;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  storage: {
    // Only "local" exists today. A production provider (S3/R2/GCS) plugs in as a new adapter
    // behind the same StoragePort — campaign/media domain code never sees the driver name.
    driver: string;
    localDir: string;
    // Base URL the local adapter's stored objects are served from (main.ts mounts the static
    // handler). A cloud adapter would return its own CDN/signed URLs instead.
    publicBaseUrl: string;
  };
  media: {
    maxImageBytes: number;
    maxVideoBytes: number;
    maxVideoDurationSeconds: number;
    // Standard frame is 1080×1440 (3:4 portrait). Tolerance is the allowed |w/h − 0.75|
    // deviation for non-exact dimensions; 0 means exactly 1080×1440 only.
    standardWidth: number;
    standardHeight: number;
    aspectRatioTolerance: number;
  };
  content: {
    // General ATTACHMENT files (images/videos supporting a Content submission) — no forced frame,
    // unlike Campaign media's branding-driven portrait requirement.
    maxAttachmentImageBytes: number;
    maxAttachmentVideoBytes: number;
    maxAttachmentVideoDurationSeconds: number;
    maxAttachmentsPerContent: number;
    // THUMBNAIL is the one attachment role where "image dimensions where required" (spec §Validation)
    // applies — reuses the same 1080×1440 (3:4 portrait) standard as Campaign media for visual
    // consistency across the catalog.
    thumbnailStandardWidth: number;
    thumbnailStandardHeight: number;
    thumbnailAspectRatioTolerance: number;
  };
  payments: {
    click: {
      merchantId: string;
      serviceId: string;
      secretKey: string;
      // "production" | "test" — operator-declared, validated against NODE_ENV in env-validation.ts
      // so a real launch can never run with test credentials without it being an explicit,
      // visible mismatch rather than a silent assumption.
      env: string;
    };
  };
  payouts: {
    // Below this, a withdrawal request is rejected (BELOW_MINIMUM) — keeps payout batches from
    // costing more in manual processing effort than the amount transferred.
    minimumPayoutMinor: number;
    // Key PayoutMethod.cardNumberEnc is encrypted under (see common/crypto/encryption.util.ts).
    encryptionKey: string;
  };
  notifications: {
    telegram: {
      // Empty string means Telegram delivery is unconfigured — TelegramBotAdapter fails loudly
      // per-send (captured as a FAILED Notification row), never silently no-ops, same convention
      // as PaymentPort/StoragePort's real-adapter-only philosophy.
      botToken: string;
    };
    email: {
      smtpHost: string;
      smtpPort: number;
      smtpUser: string;
      smtpPass: string;
      fromAddress: string;
    };
    // How many delivery attempts (initial send + retries) NotificationSweepService.retryFailed
    // will make before giving up and leaving a Notification permanently FAILED for the admin
    // failed-queue to surface.
    maxDeliveryAttempts: number;
  };
}

// Fails fast on missing secrets in non-development environments — a backend that silently
// falls back to a dev-only default JWT secret in production is a security bug, not a convenience.
function requireEnv(key: string, devFallback: string): string {
  const value = process.env[key];
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return devFallback;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: process.env.PORT ? Number(process.env.PORT) : 4000,
  webAppUrl: process.env.WEB_APP_URL ?? "http://localhost:3000",
  databaseUrl: requireEnv("DATABASE_URL", "postgresql://rosti:rosti@localhost:5432/rosti"),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "30d",
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? "local",
    localDir: process.env.STORAGE_LOCAL_DIR ?? "uploads",
    publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}/media`,
  },
  media: {
    maxImageBytes: Number(process.env.MEDIA_MAX_IMAGE_BYTES ?? 5 * 1024 * 1024),
    maxVideoBytes: Number(process.env.MEDIA_MAX_VIDEO_BYTES ?? 100 * 1024 * 1024),
    maxVideoDurationSeconds: Number(process.env.MEDIA_MAX_VIDEO_DURATION_SECONDS ?? 300),
    standardWidth: 1080,
    standardHeight: 1440,
    aspectRatioTolerance: Number(process.env.MEDIA_ASPECT_RATIO_TOLERANCE ?? 0.02),
  },
  content: {
    maxAttachmentImageBytes: Number(process.env.CONTENT_MAX_ATTACHMENT_IMAGE_BYTES ?? 5 * 1024 * 1024),
    maxAttachmentVideoBytes: Number(process.env.CONTENT_MAX_ATTACHMENT_VIDEO_BYTES ?? 100 * 1024 * 1024),
    maxAttachmentVideoDurationSeconds: Number(process.env.CONTENT_MAX_ATTACHMENT_VIDEO_DURATION_SECONDS ?? 300),
    maxAttachmentsPerContent: Number(process.env.CONTENT_MAX_ATTACHMENTS_PER_CONTENT ?? 10),
    thumbnailStandardWidth: 1080,
    thumbnailStandardHeight: 1440,
    thumbnailAspectRatioTolerance: Number(process.env.MEDIA_ASPECT_RATIO_TOLERANCE ?? 0.02),
  },
  payments: {
    click: {
      merchantId: process.env.CLICK_MERCHANT_ID ?? "",
      serviceId: process.env.CLICK_SERVICE_ID ?? "",
      // Was `process.env.CLICK_SECRET_KEY ?? "dev-click-secret-change-me"` with no requireEnv
      // wrapper — a real, confirmed Phase 14 finding: production could start with this exact,
      // publicly-readable-in-this-repo fallback string as its Click callback signing secret,
      // meaning anyone could forge a valid "payment succeeded" callback. Now fails fast in
      // production exactly like the JWT/payout secrets already did.
      secretKey: requireEnv("CLICK_SECRET_KEY", "dev-click-secret-change-me"),
      env: process.env.CLICK_ENV ?? "test",
    },
  },
  payouts: {
    minimumPayoutMinor: Number(process.env.PAYOUT_MINIMUM_MINOR ?? 100_000_00),
    encryptionKey: requireEnv("PAYOUT_ENCRYPTION_KEY", "dev-payout-encryption-key-change-me"),
  },
  notifications: {
    telegram: {
      botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    },
    email: {
      smtpHost: process.env.SMTP_HOST ?? "",
      smtpPort: Number(process.env.SMTP_PORT ?? 587),
      smtpUser: process.env.SMTP_USER ?? "",
      smtpPass: process.env.SMTP_PASS ?? "",
      fromAddress: process.env.EMAIL_FROM ?? "no-reply@rosti.uz",
    },
    maxDeliveryAttempts: Number(process.env.NOTIFICATION_MAX_DELIVERY_ATTEMPTS ?? 3),
  },
});
