# Explicitly prohibited (enforced, not just "avoided")

These are not style preferences — each one is checked against during code review because
building any of them silently turns Rosti into a generic marketplace, which defeats the point.

- Public product/course/service catalog or category navigation
- Public search of any kind
- A marketplace homepage
- "Related products" / "customers also bought" / cross-sell of any kind
- A general shopping cart holding more than the single active offer
- A public creator directory or vendor panel
- Any UI path from an offer landing (`/o/[slug]`) to a different offer
- A customer account/dashboard that lists multiple purchasable things
- Tender/bidding systems connecting creators to multiple businesses
- Chat between creators
- Lorem ipsum, "Test User", "Product 1", or other placeholder content in anything
  that ships — seed data must read as real Uzbek business content
- Non-functional buttons, fabricated stats, or a "production" page not wired to the API
- Business logic inside controllers (belongs in services)
- Writing a Commission row outside a DB transaction
- An affiliate/attribution system that trusts client-side cookies as the sole source
  of truth (server-side visitor ID + attribution record is authoritative)
- Recalculating an old order's commission when the campaign's commission rule changes later
  (each order snapshots its own rule at creation time)
- Treating security as a later phase — auth/permission checks ship with the feature, not after
