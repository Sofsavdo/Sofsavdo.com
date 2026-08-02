// Phase 14 — one aggregated, fail-fast check of the entire environment, run once at process
// startup (see main.ts) before Nest even begins bootstrapping. Two real gaps this closes:
// (1) `configuration.ts`'s `requireEnv()` helper only covered JWT/DB/payout secrets — CLICK_
// SECRET_KEY silently fell back to a well-known dev value in every environment including
// production, meaning a misconfigured production deploy would accept a forged Click callback
// signed with the same public dev secret; (2) every previous failure mode was "fail on the first
// missing var, redeploy, discover the next one" — this validates everything at once so a real
// launch only needs one failed-deploy cycle to see the complete list, not five.
//
// This is the "production-required variable list" / "optional variable list" the Phase 14 spec
// asks for, expressed as code rather than only as documentation (see ENVIRONMENT.md for the
// human-readable version of the same list).

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "PAYOUT_ENCRYPTION_KEY",
  "WEB_APP_URL",
  "API_URL",
  "CLICK_MERCHANT_ID",
  "CLICK_SERVICE_ID",
  "CLICK_SECRET_KEY",
  "CLICK_ENV",
] as const;

// Present in .env.example with a name suggesting they matter, but the app degrades gracefully
// without them (documented here so "optional" is a deliberate list, not silence-by-omission):
// REDIS_URL (best-effort cache + health signal only — see AnalyticsCacheService/HealthController),
// STORAGE_* when STORAGE_DRIVER=local — the default, dev/test-appropriate adapter (STORAGE_S3_*
// becomes required below when STORAGE_DRIVER=s3, since that's not a safe silent-fallback
// situation — a production deploy pointed at "s3" with blank credentials would upload to nothing),
// TELEGRAM_BOT_TOKEN/SMTP_* (notification delivery fails loudly per-send into a FAILED row rather
// than blocking anything), SENTRY_DSN/POSTHOG_* (monitoring is additive, never required to run),
// ANTHROPIC_API_KEY/ANTHROPIC_MODEL (the AI Product Creation Engine fails loudly per-call with
// AI_NOT_CONFIGURED when unset — see DECISIONS.md ADR-028 — an admin can always fall back to
// manual product entry, so this is never launch-blocking).

const REQUIRED_FOR_S3_STORAGE = ["STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const;

// Values that must never appear as the *actual* configured secret in production — every one of
// these is a real fallback string that exists elsewhere in this codebase (configuration.ts) for
// local development convenience. If production ever launches with one of these strings, anyone
// who has ever read this repository's source knows the "secret."
const KNOWN_DEV_FALLBACK_SECRETS = new Set(["dev-access-secret-change-me", "dev-refresh-secret-change-me", "dev-payout-encryption-key-change-me", "dev-click-secret-change-me"]);

const VALID_NODE_ENVS = new Set(["development", "test", "production"]);
const VALID_CLICK_ENVS = new Set(["production", "test"]);

export class EnvironmentValidationError extends Error {
  constructor(problems: string[]) {
    super(["Refusing to start: unsafe or incomplete environment configuration.", ...problems.map((p) => `  - ${p}`)].join("\n"));
    this.name = "EnvironmentValidationError";
  }
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Only enforced when NODE_ENV=production — development/test intentionally tolerate missing
// secrets via configuration.ts's own per-field dev fallbacks, so local setup and CI stay
// zero-config. A production deploy is the one context where "silently works with a placeholder"
// is the actual security bug, not a convenience.
export function validateEnv(env: NodeJS.ProcessEnv): void {
  const problems: string[] = [];

  if (env.NODE_ENV && !VALID_NODE_ENVS.has(env.NODE_ENV)) {
    problems.push(`NODE_ENV=${env.NODE_ENV} is not one of: ${[...VALID_NODE_ENVS].join(", ")}`);
  }

  if (env.NODE_ENV !== "production") {
    if (problems.length > 0) throw new EnvironmentValidationError(problems);
    return;
  }

  for (const key of REQUIRED_IN_PRODUCTION) {
    const value = env[key];
    if (!value || value.trim() === "") problems.push(`Missing required environment variable: ${key}`);
  }

  for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "PAYOUT_ENCRYPTION_KEY", "CLICK_SECRET_KEY"]) {
    const value = env[key];
    if (value && KNOWN_DEV_FALLBACK_SECRETS.has(value)) {
      problems.push(`${key} is set to a known development placeholder value — replace it with a real secret`);
    }
  }

  // "Click production and test credentials cannot be confused" — CLICK_ENV is the explicit,
  // operator-declared statement of which credential set this deploy is supposed to be using;
  // production must declare itself production, never left as (or defaulted to) "test".
  if (env.CLICK_ENV && !VALID_CLICK_ENVS.has(env.CLICK_ENV)) {
    problems.push(`CLICK_ENV=${env.CLICK_ENV} is not one of: ${[...VALID_CLICK_ENVS].join(", ")}`);
  } else if (env.CLICK_ENV === "test") {
    problems.push("CLICK_ENV=test in a NODE_ENV=production deploy — production must set CLICK_ENV=production");
  }

  for (const key of ["WEB_APP_URL", "API_URL", "DATABASE_URL", "REDIS_URL"]) {
    const value = env[key];
    if (value && !isValidUrl(value)) problems.push(`${key} is not a valid URL: "${value}"`);
  }

  if (env.WEB_APP_URL && !env.WEB_APP_URL.startsWith("https://")) {
    problems.push("WEB_APP_URL must be an https:// origin in production (cookies are marked Secure and will never reach an http:// frontend)");
  }

  // STORAGE_DRIVER=local (the default) is dev/test-appropriate only, but this validator doesn't
  // force a production deploy off of it — that's PRODUCTION_READINESS.md's job to flag as an
  // operational decision. What it does enforce: if an operator has explicitly opted into "s3",
  // the credentials to actually use it must be real, not silently blank.
  if (env.STORAGE_DRIVER === "s3") {
    for (const key of REQUIRED_FOR_S3_STORAGE) {
      const value = env[key];
      if (!value || value.trim() === "") problems.push(`STORAGE_DRIVER=s3 but missing required environment variable: ${key}`);
    }
  } else {
    // A real, previously-shipped-and-hit bug: configuration.ts's STORAGE_PUBLIC_BASE_URL falls
    // back to `http://localhost:${PORT}/media` when unset — a URL that only ever resolves to
    // *the visitor's own machine*, never the API server, no matter where the API is actually
    // deployed. That fallback is fine for local dev (where "localhost" really is the API), but a
    // production deploy that never set this explicitly would upload real files successfully and
    // return a URL that silently never renders for any real user — confirmed against a real
    // production incident (product images uploaded fine, displayed nowhere). Every other storage
    // misconfiguration in this validator fails loudly at boot; this one must too.
    const publicBaseUrl = env.STORAGE_PUBLIC_BASE_URL;
    if (!publicBaseUrl || publicBaseUrl.trim() === "") {
      problems.push("STORAGE_DRIVER=local (or unset) but STORAGE_PUBLIC_BASE_URL is not set — it would silently fall back to a localhost URL that no real user's browser can ever reach. Set it to this API's real public origin, e.g. https://api.sofsavdo.com/uploads");
    } else if (/localhost|127\.0\.0\.1/.test(publicBaseUrl)) {
      problems.push(`STORAGE_PUBLIC_BASE_URL="${publicBaseUrl}" points at localhost — this must be the API's real public origin (e.g. https://api.sofsavdo.com/uploads), not a loopback address, or uploaded file URLs will never resolve for real users`);
    }
  }


  if (problems.length > 0) throw new EnvironmentValidationError(problems);
}
