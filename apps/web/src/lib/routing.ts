import type { CreatorApplicationStatus } from "@rosti/types";

// Single source of truth for "where does a creator land after auth" and "can they reach the
// approved-only catalog". Used by both the (auth) pages (post-login/register redirect) and the
// (app) shell guard (blocking direct navigation to a gated route by URL).
export function postAuthRoute(status: CreatorApplicationStatus): string {
  return status === "APPROVED" ? "/creator/dashboard" : "/creator/onboarding";
}

export function canAccessApprovedOnlyRoutes(status: CreatorApplicationStatus): boolean {
  return status === "APPROVED";
}
