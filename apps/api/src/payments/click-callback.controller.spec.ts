import { ClickCallbackController } from "./click-callback.controller";

const THROTTLER_SKIP = "THROTTLER:SKIP";

describe("ClickCallbackController", () => {
  // Regression test for a real bug found the same way as HealthController's: this controller had
  // no @Throttle() override, meaning it silently inherited the global 120-req/60s-per-IP default
  // despite the class comment's stated intent that Click's callback traffic must never be
  // rate-limited. Click's infrastructure can plausibly share IPs across many merchants, so that
  // default could legitimately drop a real "payment succeeded" confirmation under load.
  it("is exempt from the global rate limiter (@SkipThrottle on the whole controller)", () => {
    expect(Reflect.getMetadata(`${THROTTLER_SKIP}default`, ClickCallbackController)).toBe(true);
  });
});
