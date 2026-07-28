"use client";

import { SelectField, TextField } from "@rosti/ui";
import { useAdminCampaigns } from "@/services/admin/campaigns";
import { useAdminProducts } from "@/services/admin/catalog";
import { useRealCreatorList } from "@/services/admin/creators";

interface EntitySelectProps {
  value?: string;
  onChange: (value: string | undefined) => void;
}

// Real dropdowns backed by the same admin list endpoints the Creators/Campaigns/Products admin
// pages already use — the Phase 13 analytics filter bar had the `extra` slot for these from the
// start (see AnalyticsFilterBar), it just had nothing plugged into it yet (Phase 14 §11 gap).
export function CreatorFilterSelect({ value, onChange }: EntitySelectProps) {
  const { data } = useRealCreatorList({ pageSize: 100 });
  return (
    <SelectField label="Creator" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">Barchasi</option>
      {(data?.items ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.displayName}
        </option>
      ))}
    </SelectField>
  );
}

export function CampaignFilterSelect({ value, onChange }: EntitySelectProps) {
  const { data } = useAdminCampaigns();
  return (
    <SelectField label="Kampaniya" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">Barchasi</option>
      {(data ?? []).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </SelectField>
  );
}

export function ProductFilterSelect({ value, onChange }: EntitySelectProps) {
  const { data } = useAdminProducts();
  return (
    <SelectField label="Mahsulot" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">Barchasi</option>
      {(data ?? []).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SelectField>
  );
}

// A <select> here — rather than the entity dropdowns above — would need a fixed list of region
// names to offer as options. There isn't one: Order.address.region is free text the customer
// typed at checkout (see schema.prisma's Address model), not chosen from any enforced enum, and
// the backend filter matches it with a case-insensitive `contains` (see AnalyticsQueryDto/
// payment-analytics.service.ts etc.) specifically to tolerate that. A hardcoded dropdown of
// "standard" Uzbekistan region names could easily mismatch real stored values and silently return
// zero results — a text input that mirrors the backend's own matching semantics is the correct
// fit, not a missed dropdown.
export function RegionFilterInput({ value, onChange }: EntitySelectProps) {
  return <TextField label="Viloyat" placeholder="Toshkent..." value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} />;
}
