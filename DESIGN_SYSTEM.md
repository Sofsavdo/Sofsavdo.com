# Design system

Two visual directions in one system — sharing tokens, diverging in density and intent.

| | Creator / Admin | Offer landing |
|---|---|---|
| Goal | Dense, fast, analytical | Single-minded conversion |
| Navigation | Full sidebar/nav | None beyond one CTA |
| Motion | Functional only | Functional only, slightly more presence in hero |

## Color tokens

```css
--color-bg:            #F7F7F5;
--color-surface:        #FFFFFF;
--color-text-primary:   #171717;
--color-text-secondary: #666666;
--color-text-muted:     #929292;
--color-accent:         #E53935;
--color-accent-hover:   #C92F2B;
--color-dark:           #111111;
--color-border:         #E7E7E3;
--color-success:        #219653;
--color-warning:        #F2C94C;
--color-error:          #D92D20;
--color-info:           #2F80ED;
```

`--color-accent` is reserved for: primary CTA, discount/promo badges, active nav item, critical
KPI callouts, and notification badges. It is never used as a section background or for large
surface fills — a page that is "mostly red" is treated as a design bug, not a brand expression.

## Typography

```
--font-heading: "Manrope", sans-serif;
--font-body:    "Inter", sans-serif;
--font-numeric: "Manrope", sans-serif; /* KPIs, prices, commission figures */
```

Scale (rem, 16px base): `12/14/16/18/20/24/30/36/48` — headings start at 20, KPI numbers use
30–48 with `font-variant-numeric: tabular-nums` so dashboard columns of numbers align.

## Radius

```
--radius-button: 10px;   --radius-input: 10px;
--radius-card:   16px;   --radius-media: 22px;
```

## Layout

```
--max-width: 1280px;
--pad-desktop: 32px;  --pad-tablet: 24px;  --pad-mobile: 16px;
```

## Motion

Allowed: hover states, modal/drawer enter-exit, dropdown, toast, skeleton shimmer, light chart
transitions (opacity/height, ≤200ms). Not allowed: parallax, scroll-jacking, decorative
looping animation, anything that doesn't communicate a state change. `prefers-reduced-motion`
disables all non-essential transition/animation globally.

## Component rules

- Buttons: solid accent for the single primary action per view; everything else is
  outline/ghost. No more than one solid-accent button visible at a time on a landing page
  (the sticky mobile CTA replaces, not duplicates, the in-page one when both would be visible).
- Cards: `--radius-card`, 1px `--color-border`, no drop shadow beyond a 1–2px ambient shadow —
  flat, not skeuomorphic.
- Tables (admin/creator): dense row height (40–44px), sticky header, numeric columns
  right-aligned with tabular figures, status as a colored pill using the semantic tokens above
  (never accent red for a neutral status).
- Charts: Recharts, using semantic tokens only (`--color-accent` for the single highlighted
  series, `--color-text-muted` for gridlines/axis).
- Forms: label above input, inline validation error in `--color-error` below the field, no
  placeholder-as-label.

## Landing page vs. dashboard, concretely

An offer landing (`/o/[slug]`) never reuses the admin/creator shell (no sidebar component, no
top nav with multiple links) — it is built from the `LandingSection` components listed in
PRODUCT_MODEL.md/ARCHITECTURE.md, each a standalone, full-width block. The creator/admin shell is
a persistent sidebar (desktop) / bottom nav (mobile, creator only) layout wrapping route content —
see the sidebar/bottom-nav item lists in ARCHITECTURE.md's route map.

## Design source of truth until Figma is connected

No Figma MCP is currently authorized in this session (see README.md audit note). Until the user
connects it via claude.ai connector settings, this document plus the token values above (to be
materialized as a Tailwind preset in `packages/config/tailwind-preset.ts` in Phase 2) are the
source of truth, and every page will be checked visually in the in-app Browser against these
rules rather than against a Figma file.
