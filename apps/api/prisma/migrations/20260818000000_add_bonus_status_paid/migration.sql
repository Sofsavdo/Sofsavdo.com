-- payouts.service.ts's requestPayout() marked a successfully-redeemed LaunchBonus as "EXPIRED"
-- (the only other terminal state that existed) to prevent reuse once it was folded into a payout.
-- This conflated "creator met every requirement and cashed out" with "creator failed to meet
-- requirements by the deadline, bonus forfeited" -- the exact opposite outcome, both showing
-- identically as EXPIRED in the creator's own bonus history. Adds a distinct terminal state for
-- the success path.
ALTER TYPE "BonusStatus" ADD VALUE IF NOT EXISTS 'PAID';
