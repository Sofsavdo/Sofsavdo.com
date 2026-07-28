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

## Phase 15 additions

- **Brand**: centralized in `packages/config/brand.ts` (`BRAND.name`, `BRAND.supportEmail`) —
  every page that names the product or its support address imports from there instead of a string
  literal, so a future rename touches one file.
- **Fonts are now real**: `next/font/google` (Inter + Manrope, `latin`+`cyrillic` subsets) wired in
  `apps/web/app/layout.tsx`. Previously "Manrope"/"Inter" were only CSS `font-family` names with no
  actual font file ever loaded — the whole app rendered in the OS default sans-serif the entire
  time before this.
- **`font-numeric` utility** now applies `font-variant-numeric: tabular-nums` automatically
  (previously font-family only — every page wanting aligned digit columns had to add
  `tabular-nums` separately and most, but not all, remembered to).
- **New tokens**: `--color-surface-muted` (nested/inset panels, mobile-card zebra rows),
  `--color-border-strong` (emphasis without a shadow), `--shadow-card`/`--shadow-elevated`
  (materializes the "1–2px ambient shadow" rule that was previously prose-only).
- **New shared components** (`packages/ui`): `IconButton`, `Dialog` (generic — `ConfirmModal`
  keeps its own implementation, not refactored onto this, to avoid regressing its many existing
  call sites for no functional gain), `Tabs`, `Tooltip`, `MobileDataCard` (the mobile fallback for
  data tables — pair a real `<table>` behind `hidden md:block` with this behind `md:hidden` at each
  table's own call site), `ChartCard` (standard chart shell; Recharts color props should reference
  `var(--color-accent)` etc. directly rather than re-typing hex, now that doing so actually works).

## Tailwind content scanning across the monorepo — a real, confirmed gap (Phase 15)

Tailwind v4's zero-config auto-detection only walks the directory tree from `globals.css`
outward within `apps/web`'s own project root — it never reaches `packages/ui` (a sibling
workspace package outside that tree). Any utility class used **only** inside a `packages/ui`
component, with no coincidental match elsewhere in `apps/web`, was silently never generated at
all — no build warning, no error, the class just doesn't exist in the shipped CSS. Confirmed via
direct CSSOM inspection: `hidden md:block` on `DataTableShell`'s table wrapper produced zero
`.md\:block` rules even after a full `.next` cache wipe and dev-server restart, while `md:hidden`/
`md:flex` in the same file "worked" purely because those exact strings also happen to appear in
`apps/web/src/components/admin/AdminShell.tsx`. Fixed by adding `@source "../../../packages/ui/src";`
to `globals.css`. **Any future `packages/ui` component should be spot-checked for a genuinely new
utility combination if something renders unstyled** — this class of bug produces no error anywhere,
only a silently-missing style.

## Design source of truth until Figma is connected

No Figma MCP is currently authorized in this session (see README.md audit note). Until the user
connects it via claude.ai connector settings, this document plus the token values above (to be
materialized as a Tailwind preset in `packages/config/tailwind-preset.ts` in Phase 2) are the
source of truth, and every page will be checked visually in the in-app Browser against these
rules rather than against a Figma file.
