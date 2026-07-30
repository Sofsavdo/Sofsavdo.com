import type { CreatorApplicationStatus } from "@sofsavdo/types";

// Single source of truth for three related-but-distinct questions about a creator's post-auth
// access: where they land, whether they can enter the cabinet shell at all (vs still needing to
// finish the onboarding wizard), and whether they can reach earning-capable features once inside.
export function postAuthRoute(status: CreatorApplicationStatus): string {
  return canEnterCabinet(status) ? "/creator/dashboard" : "/creator/onboarding";
}

// SUBMITTED/UNDER_REVIEW creators have nothing left to do on the onboarding form — they're purely
// waiting on an admin decision — so they can see their cabinet (dashboard, profile, notifications)
// the same as an APPROVED creator, just without any earning-capable feature (see
// canWorkAsCreator below). DRAFT/CHANGES_REQUESTED/REJECTED still need to act on the onboarding
// wizard before there's anything meaningful to show inside the cabinet, so those stay routed there.
export function canEnterCabinet(status: CreatorApplicationStatus): boolean {
  return status === "SUBMITTED" || status === "UNDER_REVIEW" || status === "APPROVED";
}

// Referral links, campaign applications, content submission, sales/commissions/balance/payouts,
// Creator Fund, leaderboard, and competitions all either generate a referral link or move real
// money — every one of them requires a fully APPROVED application, not just "submitted and
// waiting". Used both to gate the sidebar nav (CreatorShell) and to bounce direct URL navigation
// back to the dashboard (CreatorAppGuard).
export function canWorkAsCreator(status: CreatorApplicationStatus): boolean {
  return status === "APPROVED";
}
