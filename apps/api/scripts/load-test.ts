import "reflect-metadata";
import { randomUUID, createHash } from "node:crypto";
import autocannon, { type Options, type Request, type Result } from "autocannon";

// Phase 14 §13 — lightweight local load test for the platform's named critical paths: landing
// page read, referral visit tracking, checkout, Click callback, admin order list, creator
// campaign list, executive analytics. Realistic concurrency (single-digit/low-double-digit
// connections), not a stress test — the goal is a first read on latency/throughput/failure rate
// and an early signal of DB/Redis bottlenecks, not to find a breaking point.
//
// Requires a REAL running API instance with a REAL, reachable database — this script makes real
// HTTP requests, it does not mock anything. Point it at a disposable/staging environment, never
// at production.
//
// Usage:
//   LOADTEST_OFFER_SLUG=<a seeded public offer slug> npm run loadtest --workspace=@rosti/api
//
// Optional env vars (each named check is skipped — not failed — if its token/slug isn't
// provided, since not every environment has all of these seeded/available):
//   LOADTEST_API_URL             default http://localhost:4000
//   LOADTEST_OFFER_SLUG          required for landing/visit/checkout/click
//   LOADTEST_ADMIN_TOKEN         a real ADMIN/SUPER_ADMIN bearer access token — enables the
//                                 admin order list and executive analytics checks
//   LOADTEST_CREATOR_TOKEN       a real creator bearer access token — enables the creator
//                                 campaign list check
//   LOADTEST_CLICK_SECRET_KEY    must match the running instance's CLICK_SECRET_KEY — enables
//                                 the Click callback check (a validly-signed payload is
//                                 constructed the same way ClickPaymentAdapter verifies one)
//   LOADTEST_CLICK_SERVICE_ID    must match the running instance's CLICK_SERVICE_ID (defaults to
//                                 empty, matching an unconfigured dev/test instance)
//   LOADTEST_DURATION_SECONDS    default 10 (per endpoint)
//   LOADTEST_CONNECTIONS         default 10 (concurrent connections, per endpoint)

const API_URL = (process.env.LOADTEST_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const OFFER_SLUG = process.env.LOADTEST_OFFER_SLUG;
const ADMIN_TOKEN = process.env.LOADTEST_ADMIN_TOKEN;
const CREATOR_TOKEN = process.env.LOADTEST_CREATOR_TOKEN;
const CLICK_SECRET_KEY = process.env.LOADTEST_CLICK_SECRET_KEY;
const CLICK_SERVICE_ID = process.env.LOADTEST_CLICK_SERVICE_ID ?? "";
const DURATION_SECONDS = Number(process.env.LOADTEST_DURATION_SECONDS ?? 10);
const CONNECTIONS = Number(process.env.LOADTEST_CONNECTIONS ?? 10);

interface CheckResult {
  name: string;
  skipped?: string;
  result?: Result;
}

function run(opts: Options): Promise<Result> {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, res) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve(res)));
  });
}

function summarize(name: string, res: Result): CheckResult {
  return { name, result: res };
}

function report(check: CheckResult): void {
  if (check.skipped) {
    console.log(`\n[SKIPPED] ${check.name} — ${check.skipped}`);
    return;
  }
  const r = check.result!;
  console.log(`\n[${check.name}]`);
  console.log(`  requests: ${r.requests.total} (${r.requests.average.toFixed(1)}/s avg)`);
  console.log(`  latency:  avg=${r.latency.average.toFixed(1)}ms p50=${r.latency.p50}ms p99=${r.latency.p99}ms max=${r.latency.max}ms`);
  console.log(`  status:   2xx=${r["2xx"]} 4xx=${r["4xx"]} 5xx=${r["5xx"]} errors=${r.errors} timeouts=${r.timeouts}`);
  console.log(`  throughput: ${(r.throughput.average / 1024).toFixed(1)} KB/s`);
}

async function checkoutOnce(): Promise<{ orderId: string; paymentId: string; amountMinor: number } | null> {
  const res = await fetch(`${API_URL}/offers/${OFFER_SLUG}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentMethod: "CLICK",
      idempotencyKey: `loadtest-${randomUUID()}`,
      customer: { fullName: "Load Test", phone: "+998901234567", email: "loadtest@example.uz" },
    }),
  });
  if (!res.ok) {
    console.warn(`  (could not create a real order for the Click check — POST /checkout returned ${res.status}; skipping)`);
    return null;
  }
  const body = (await res.json()) as { id?: string; paymentId?: string; totalMinor?: number };
  if (!body.id || !body.paymentId) return null;
  return { orderId: body.id, paymentId: body.paymentId, amountMinor: body.totalMinor ?? 0 };
}

function signClickComplete(fields: { clickTransId: string; merchantTransId: string; merchantPrepareId: string; amount: string; signTime: string }): string {
  // Mirrors ClickPaymentAdapter.computeSignature's action=1 (Complete) branch exactly — see
  // apps/api/src/payments/click-payment.adapter.ts. Kept in sync manually since this script
  // deliberately has no dependency on the Nest application context.
  const parts = [fields.clickTransId, CLICK_SERVICE_ID, CLICK_SECRET_KEY, fields.merchantTransId, fields.merchantPrepareId, fields.amount, "1", fields.signTime];
  return createHash("md5").update(parts.join("")).digest("hex");
}

async function main() {
  const results: CheckResult[] = [];
  const baseOpts = { url: API_URL, duration: DURATION_SECONDS, connections: CONNECTIONS };

  // 1. API process baseline — no DB/Redis touched, so this is the ceiling the DB-backed checks
  // below are measured against.
  results.push(summarize("Health liveness (baseline, no DB)", await run({ ...baseOpts, url: `${API_URL}/health/live` })));

  if (!OFFER_SLUG) {
    console.warn("\nLOADTEST_OFFER_SLUG not set — skipping landing page, visit tracking, checkout, and Click callback checks.");
  } else {
    // 2. Landing page read — the single highest-traffic public read in this platform (every
    // creator referral link lands here).
    results.push(summarize("Landing page read (GET /offers/:slug/public)", await run({ ...baseOpts, url: `${API_URL}/offers/${OFFER_SLUG}/public` })));

    // 3. Referral visit tracking — fires on every landing page view, writes a ReferralVisit row.
    results.push(
      summarize(
        "Referral visit tracking (POST /offers/:slug/visit)",
        await run({
          ...baseOpts,
          url: `${API_URL}/offers/${OFFER_SLUG}/visit`,
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ utmSource: "loadtest" }),
        }),
      ),
    );

    // 4. Checkout — the platform's core write path (Order + Payment + stock reservation in one
    // transaction). Each request needs a fresh idempotencyKey/email or every retry after the
    // first would just return the same Order — autocannon's setupRequest hook regenerates both
    // per request so this measures real Order-creation cost, not idempotent-replay cost.
    const checkoutRequest: Request = {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paymentMethod: "CLICK", idempotencyKey: "placeholder", customer: { fullName: "Load Test", phone: "+998901234567" } }),
      setupRequest: (req) => {
        const key = `loadtest-${randomUUID()}`;
        req.body = JSON.stringify({ paymentMethod: "CLICK", idempotencyKey: key, customer: { fullName: "Load Test", phone: "+998901234567", email: `${key}@example.uz` } });
        return req;
      },
    };
    results.push(
      summarize(
        "Checkout (POST /offers/:slug/checkout)",
        await run({ ...baseOpts, url: `${API_URL}/offers/${OFFER_SLUG}/checkout`, requests: [checkoutRequest] }),
      ),
    );

    // 5. Click callback — requires a real pending Payment to call Complete against. Provisioned
    // once (not part of the timed load), then the SAME valid signed payload is replayed under
    // load: this measures the already-processed replay-protection fast path (see
    // PaymentsService.handleClickCallback), which is what a real Click retry storm against an
    // already-settled payment actually looks like — not first-time processing, which can only
    // happen once per payment by definition.
    if (!CLICK_SECRET_KEY) {
      results.push({ name: "Click callback (POST /payments/click/complete)", skipped: "LOADTEST_CLICK_SECRET_KEY not set" });
    } else {
      const provisioned = await checkoutOnce();
      if (!provisioned) {
        results.push({ name: "Click callback (POST /payments/click/complete)", skipped: "could not provision a real Payment to call Complete against" });
      } else {
        const signTime = new Date().toISOString().slice(0, 19).replace("T", " ");
        const amount = (provisioned.amountMinor / 100).toFixed(2);
        const clickTransId = String(Date.now());
        const signString = signClickComplete({ clickTransId, merchantTransId: provisioned.paymentId, merchantPrepareId: provisioned.paymentId, amount, signTime });
        const body = new URLSearchParams({
          click_trans_id: clickTransId,
          service_id: CLICK_SERVICE_ID,
          merchant_trans_id: provisioned.paymentId,
          merchant_prepare_id: provisioned.paymentId,
          amount,
          action: "1",
          error: "0",
          error_note: "",
          sign_time: signTime,
          sign_string: signString,
        }).toString();
        results.push(
          summarize(
            "Click callback replay (POST /payments/click/complete, already-processed fast path)",
            await run({ ...baseOpts, url: `${API_URL}/payments/click/complete`, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body }),
          ),
        );
      }
    }
  }

  // 6. Admin order list — the busiest operator-facing read.
  if (!ADMIN_TOKEN) {
    results.push({ name: "Admin order list (GET /admin/orders)", skipped: "LOADTEST_ADMIN_TOKEN not set" });
    results.push({ name: "Executive analytics (GET /admin/analytics/executive)", skipped: "LOADTEST_ADMIN_TOKEN not set" });
  } else {
    const authHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };
    results.push(summarize("Admin order list (GET /admin/orders)", await run({ ...baseOpts, url: `${API_URL}/admin/orders`, headers: authHeaders })));
    results.push(
      summarize("Executive analytics (GET /admin/analytics/executive)", await run({ ...baseOpts, url: `${API_URL}/admin/analytics/executive`, headers: authHeaders })),
    );
  }

  // 7. Creator campaign list.
  if (!CREATOR_TOKEN) {
    results.push({ name: "Creator campaign list (GET /creator/campaigns)", skipped: "LOADTEST_CREATOR_TOKEN not set" });
  } else {
    results.push(
      summarize("Creator campaign list (GET /creator/campaigns)", await run({ ...baseOpts, url: `${API_URL}/creator/campaigns`, headers: { authorization: `Bearer ${CREATOR_TOKEN}` } })),
    );
  }

  console.log(`\n${"=".repeat(60)}\nLoad test results — ${DURATION_SECONDS}s / ${CONNECTIONS} connections per check\n${"=".repeat(60)}`);
  for (const check of results) report(check);

  const anyFailures = results.some((c) => c.result && (c.result["5xx"] > 0 || c.result.errors > 0 || c.result.timeouts > 0));
  if (anyFailures) {
    console.warn("\nAt least one check reported 5xx responses, connection errors, or timeouts — see above.");
    process.exitCode = 1;
  }
}

void main();
