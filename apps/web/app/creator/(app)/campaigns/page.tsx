"use client";

import { useMemo, useState } from "react";
import { Alert, Button, EmptyState, SelectField, Skeleton, TextField } from "@sofsavdo/ui";
import type { CommissionType, SocialPlatform } from "@sofsavdo/types";
import { useCampaigns } from "@/services/campaigns";
import { CampaignCard } from "@/components/creator/CampaignCard";

const CATEGORY_ALL = "ALL";

export default function CampaignsCatalogPage() {
  const campaignsQuery = useCampaigns();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(CATEGORY_ALL);
  const [platform, setPlatform] = useState<SocialPlatform | "ALL">("ALL");
  const [commissionType, setCommissionType] = useState<CommissionType | "ALL">("ALL");
  const [barterOnly, setBarterOnly] = useState(false);
  const [freeProductOnly, setFreeProductOnly] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set((campaignsQuery.data ?? []).map((c) => c.category))),
    [campaignsQuery.data],
  );

  const filtered = useMemo(() => {
    return (campaignsQuery.data ?? []).filter((c) => {
      // Real mode's GET /creator/campaigns already only ever returns LIVE campaigns (server-side
      // gated — see RBAC.md); this check is redundant-but-harmless there and is the actual gate
      // in mock mode, which has no server-side availability computation.
      if (c.status !== "ACTIVE") return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== CATEGORY_ALL && c.category !== category) return false;
      if (platform !== "ALL" && !c.platforms.includes(platform)) return false;
      if (commissionType !== "ALL" && c.commissionType !== commissionType) return false;
      if (barterOnly && !c.barterEnabled) return false;
      if (freeProductOnly && !c.freeProduct) return false;
      return true;
    });
  }, [campaignsQuery.data, search, category, platform, commissionType, barterOnly, freeProductOnly]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Kampaniyalar</h1>
        <p className="font-body text-sm text-text-secondary">
          Faqat tasdiqlangan creatorlar uchun yopiq katalog — bu yerdagi kampaniyalarni boshqa hech kim ko&apos;rmaydi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
        <TextField label="Qidirish" placeholder="Kampaniya nomi" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField label="Kategoriya" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value={CATEGORY_ALL}>Barchasi</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Platforma"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as SocialPlatform | "ALL")}
        >
          <option value="ALL">Barchasi</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="TIKTOK">TikTok</option>
          <option value="YOUTUBE">YouTube</option>
          <option value="TELEGRAM">Telegram</option>
        </SelectField>
        <SelectField
          label="Komissiya turi"
          value={commissionType}
          onChange={(e) => setCommissionType(e.target.value as CommissionType | "ALL")}
        >
          <option value="ALL">Barchasi</option>
          <option value="PERCENTAGE">Foizli</option>
          <option value="FIXED_AMOUNT">Belgilangan summa</option>
        </SelectField>
        <div className="flex flex-col justify-end gap-2 pb-0.5">
          <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
            <input type="checkbox" checked={barterOnly} onChange={(e) => setBarterOnly(e.target.checked)} />
            Faqat barter
          </label>
          <label className="flex items-center gap-2 font-body text-sm text-text-secondary">
            <input type="checkbox" checked={freeProductOnly} onChange={(e) => setFreeProductOnly(e.target.checked)} />
            Bepul mahsulot bor
          </label>
        </div>
      </div>

      {campaignsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : campaignsQuery.isError ? (
        <Alert tone="error">
          Kampaniyalarni yuklashda xatolik yuz berdi.{" "}
          <button type="button" onClick={() => campaignsQuery.refetch()} className="underline">
            Qayta urinish
          </button>
        </Alert>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Kampaniya topilmadi"
          description="Filtrlarni o'zgartirib ko'ring yoki keyinroq qayta tekshiring."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch("");
                setCategory(CATEGORY_ALL);
                setPlatform("ALL");
                setCommissionType("ALL");
                setBarterOnly(false);
                setFreeProductOnly(false);
              }}
            >
              Filtrlarni tozalash
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
