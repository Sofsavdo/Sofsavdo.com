import { validateEnv, EnvironmentValidationError } from "./env-validation";

function baseProdEnv(overrides: Partial<NodeJS.ProcessEnv> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@host:5432/db",
    JWT_ACCESS_SECRET: "real-access-secret",
    JWT_REFRESH_SECRET: "real-refresh-secret",
    PAYOUT_ENCRYPTION_KEY: "real-payout-key",
    WEB_APP_URL: "https://sofsavdo.com",
    API_URL: "https://api.sofsavdo.com",
    CLICK_MERCHANT_ID: "12345",
    CLICK_SERVICE_ID: "67890",
    CLICK_SECRET_KEY: "real-click-secret",
    CLICK_ENV: "production",
    ...overrides,
  };
}

describe("validateEnv", () => {
  it("passes for development with nothing set", () => {
    expect(() => validateEnv({ NODE_ENV: "development" })).not.toThrow();
  });

  it("passes for test with nothing set", () => {
    expect(() => validateEnv({ NODE_ENV: "test" })).not.toThrow();
  });

  it("passes for a fully-configured production environment", () => {
    expect(() => validateEnv(baseProdEnv())).not.toThrow();
  });

  it("rejects an unrecognized NODE_ENV value", () => {
    expect(() => validateEnv({ NODE_ENV: "staging" })).toThrow(EnvironmentValidationError);
  });

  it("throws listing every missing required variable at once, not just the first", () => {
    const env = baseProdEnv({ CLICK_SECRET_KEY: undefined, CLICK_MERCHANT_ID: undefined });
    try {
      validateEnv(env);
      throw new Error("expected validateEnv to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EnvironmentValidationError);
      expect((err as Error).message).toContain("CLICK_SECRET_KEY");
      expect((err as Error).message).toContain("CLICK_MERCHANT_ID");
    }
  });

  it("rejects the known dev-fallback CLICK_SECRET_KEY value in production", () => {
    expect(() => validateEnv(baseProdEnv({ CLICK_SECRET_KEY: "dev-click-secret-change-me" }))).toThrow(/development placeholder/);
  });

  it("rejects the known dev-fallback JWT secrets in production", () => {
    expect(() => validateEnv(baseProdEnv({ JWT_ACCESS_SECRET: "dev-access-secret-change-me" }))).toThrow(/development placeholder/);
  });

  it("rejects CLICK_ENV=test when NODE_ENV=production", () => {
    expect(() => validateEnv(baseProdEnv({ CLICK_ENV: "test" }))).toThrow(/CLICK_ENV=test/);
  });

  it("rejects a non-https WEB_APP_URL in production", () => {
    expect(() => validateEnv(baseProdEnv({ WEB_APP_URL: "http://sofsavdo.com" }))).toThrow(/https/);
  });

  it("rejects a malformed URL value", () => {
    expect(() => validateEnv(baseProdEnv({ DATABASE_URL: "not-a-url" }))).toThrow(/not a valid URL/);
  });

  it("passes with STORAGE_DRIVER unset or local, even with no storage credentials configured", () => {
    expect(() => validateEnv(baseProdEnv())).not.toThrow();
    expect(() => validateEnv(baseProdEnv({ STORAGE_DRIVER: "local" }))).not.toThrow();
  });

  it("rejects STORAGE_DRIVER=s3 with no bucket/credentials configured", () => {
    expect(() => validateEnv(baseProdEnv({ STORAGE_DRIVER: "s3" }))).toThrow(/STORAGE_DRIVER=s3 but missing required environment variable/);
  });

  it("passes STORAGE_DRIVER=s3 once bucket/credentials are all set", () => {
    expect(() =>
      validateEnv(
        baseProdEnv({
          STORAGE_DRIVER: "s3",
          STORAGE_BUCKET: "my-bucket",
          STORAGE_ACCESS_KEY_ID: "key",
          STORAGE_SECRET_ACCESS_KEY: "secret",
        }),
      ),
    ).not.toThrow();
  });
});
