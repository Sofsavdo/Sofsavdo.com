import { NextRequest, NextResponse } from "next/server";

// A shared referral link (getReferralUrl() in services/flows.ts) is built at this web app's own
// origin — sofsavdo.com/r/CODE — but the actual resolve-and-redirect logic (flow lookup, click
// counting, referral/flow cookies, final redirect to /o/[slug]?ref=CODE) has only ever lived on
// the API (apps/api/src/flows/referral.controller.ts's GET /r/:code), which is a different
// subdomain. Since no page existed at this path on the web app at all, every referral link, QR
// code, and share button sent a buyer straight to a 404. This route is a thin, branded pass-through
// that hands off to the real logic rather than duplicating it — the browser follows one extra fast
// redirect through api.sofsavdo.com, invisible to the person clicking the link.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return NextResponse.redirect(`${API_URL}/r/${encodeURIComponent(code)}`, 307);
}
