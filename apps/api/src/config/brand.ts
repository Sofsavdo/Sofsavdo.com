// Backend-local mirror of packages/config/brand.ts — NOT a re-export. Confirmed by hitting a real
// runtime failure: Next.js's bundler transpiles a workspace package's raw .ts source as part of
// its own module graph (so the frontend importing `@sofsavdo/config/brand` directly just works), but
// NestJS's dev/prod runtime `require()`s it as a plain Node module outside `src/`'s own compile
// step — Node's native loader tried to execute the untranspiled `.ts` file directly and choked on
// `as const` (`SyntaxError: Unexpected identifier 'as'`). Making packages/config a real build step
// producing consumable JS output is real infrastructure work out of scope for a brand-name change,
// so the two runtimes each keep their own copy of these two strings instead — same trade-off this
// plan's own Phase B notes flagged as a possibility ahead of time.
export const BRAND = {
  name: "Sofsavdo",
  supportEmail: "support@sofsavdo.com",
} as const;
