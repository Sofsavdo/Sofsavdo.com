import { SetMetadata } from "@nestjs/common";

export const IS_OPTIONAL_AUTH_KEY = "isOptionalAuth";

// Distinct from @Public(): a @Public() route never runs the JWT strategy at all, so req.user is
// always undefined even if a valid token was sent. @OptionalAuth() still runs the strategy (so a
// logged-in buyer's session is recognized when present) but never rejects a request for a
// missing/invalid token — used only where guest and authenticated behavior are both genuinely
// valid (checkout, so a logged-in buyer's order links to their account without a separate
// "claim this order" step). See JwtAuthGuard.handleRequest for the actual behavior.
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
