# Explicitly prohibited (enforced, not just "avoided")

These are not style preferences — each one is checked against during code review because
building any of them silently turns Sofsavdo into a generic marketplace, which defeats the point.

- Public category navigation or taxonomy browsing — no `Category`/taxonomy model exists in the
  schema; `/catalog`'s own filters (Phase E, `CatalogQueryDto`) are deliberately limited to
  product type and price range, nothing more structured than that
- Public search of any kind (still banned everywhere, including on `/catalog` itself — see
  `CatalogQueryDto`'s own comment: no `search` field exists on that DTO at all)
- A homepage that shows more than a small, server-capped set of curated "featured" products
  (see `OffersService.listFeaturedPublic`'s `FEATURED_OFFERS_LIMIT`, Phase C/DECISIONS.md
  ADR-022) — no full catalog, no filtering, no search on the homepage itself; browsing the
  full catalog happens only at `/catalog` (Phase E, DECISIONS.md ADR-025), reached only via the
  one deliberate homepage/footer link, never surfaced inline as part of the homepage sections
- "Related products" / "customers also bought" / algorithmic cross-sell of any kind — a buyer's
  own Saved Products (Phase D) and `/catalog` (Phase E) are both curation/browsing the buyer
  themselves controls, not the platform recommending; that distinction is the actual rule here,
  not "never show more than one product" (which Phase D's Buyer Accounts already superseded —
  see below)
- A general shopping cart holding more than the single active offer
- A public creator directory or vendor panel
- Any UI path from an offer landing (`/o/[slug]`) to a different offer — `/catalog` is reached
  only from the homepage/footer, never linked from inside a landing page itself
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
