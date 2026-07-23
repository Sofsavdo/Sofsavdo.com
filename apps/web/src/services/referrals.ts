"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";
import { useSession } from "./session";

// Creator's own referral dashboard (6B Enhancement) — real backend only; see lib/api/index.ts's
// mock fallbacks (empty/zeroed, never fake data).

export function useReferralCode() {
  const { user } = useSession();
  return useQuery({ queryKey: ["referral-code"], queryFn: api.getReferralCode, enabled: !!user });
}

export function useReferralSummary() {
  const { user } = useSession();
  return useQuery({ queryKey: ["referral-summary"], queryFn: api.getReferralSummary, enabled: !!user });
}

export function useMyReferrals() {
  const { user } = useSession();
  return useQuery({ queryKey: ["my-referrals"], queryFn: api.getMyReferrals, enabled: !!user });
}

export function useMyReferralRewards() {
  const { user } = useSession();
  return useQuery({ queryKey: ["my-referral-rewards"], queryFn: api.getMyReferralRewards, enabled: !!user });
}
