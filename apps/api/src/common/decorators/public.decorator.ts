import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

// Marks a route as reachable without a JWT — the buyer-facing endpoints (/offers/:slug/public,
// /referrals/track, /orders, /auth/login, etc.). JwtAuthGuard checks for this before enforcing auth.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
