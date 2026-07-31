"use client";

import { useMemo } from "react";
import type { DeliveryRegionPublic } from "@sofsavdo/types";
import { formatMoneyMinor } from "@sofsavdo/types";
import { UZ_DELIVERY_ZONES, UZ_VILOYATLAR } from "@/lib/uz-regions";

const ZONE_TO_VILOYAT = new Map(UZ_DELIVERY_ZONES.map((z) => [z.code, z.viloyatCode]));
// A one-off region an admin added by hand through the manual "bitta hudud" form (not from the
// canonical list) has no known viloyat to group under — bucketed here instead of hidden.
const OTHER_VILOYAT_CODE = "__other__";

// Two cascading <select>s (viloyat, then tuman/shahar within it) instead of one flat list — an
// offer can carry ~190 delivery zones once "Standart narxlarni qo'llash" has been used, and a
// buyer picking their delivery region should never have to scroll a 190-item dropdown to find it.
// Shared by DeliveryQuoteBox (offer landing page) and CheckoutPageClient (checkout form) so both
// present the same picker.
export function RegionSelect({
  regions,
  value,
  onChange,
  className,
}: {
  regions: DeliveryRegionPublic[];
  value: string;
  onChange: (regionCode: string) => void;
  className?: string;
}) {
  const groups = useMemo(() => {
    const byViloyat = new Map<string, DeliveryRegionPublic[]>();
    for (const r of regions) {
      const viloyatCode = ZONE_TO_VILOYAT.get(r.regionCode) ?? OTHER_VILOYAT_CODE;
      const list = byViloyat.get(viloyatCode) ?? [];
      list.push(r);
      byViloyat.set(viloyatCode, list);
    }
    return byViloyat;
  }, [regions]);

  const viloyatOptions = useMemo(() => {
    const known = UZ_VILOYATLAR.filter((v) => groups.has(v.code));
    return groups.has(OTHER_VILOYAT_CODE) ? [...known, { code: OTHER_VILOYAT_CODE, name: "Boshqa hududlar" }] : known;
  }, [groups]);

  // Derived directly from `value` on every render, no local state/effect needed — picking a
  // viloyat always also picks its first zone in the very same handler below, so `value` and its
  // owning viloyat are never out of sync for more than one render.
  const selectedViloyat = useMemo(() => {
    for (const [viloyatCode, list] of groups) {
      if (list.some((r) => r.regionCode === value)) return viloyatCode;
    }
    return viloyatOptions[0]?.code ?? OTHER_VILOYAT_CODE;
  }, [groups, value, viloyatOptions]);

  const zonesInViloyat = groups.get(selectedViloyat) ?? [];

  return (
    <div className={`grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 ${className ?? ""}`}>
      <select
        value={selectedViloyat}
        onChange={(e) => {
          const first = groups.get(e.target.value)?.[0];
          if (first) onChange(first.regionCode);
        }}
        className="h-10 w-full min-w-0 rounded-input border border-border bg-surface px-3 font-body text-sm text-text-primary"
      >
        {viloyatOptions.map((v) => (
          <option key={v.code} value={v.code}>
            {v.name}
          </option>
        ))}
      </select>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full min-w-0 rounded-input border border-border bg-surface px-3 font-body text-sm text-text-primary"
      >
        {zonesInViloyat.map((r) => (
          <option key={r.regionCode} value={r.regionCode}>
            {r.regionName}
            {r.feeType === "FREE" ? " — Bepul" : ` — ${formatMoneyMinor(r.deliveryFeeMinor, r.currency)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
