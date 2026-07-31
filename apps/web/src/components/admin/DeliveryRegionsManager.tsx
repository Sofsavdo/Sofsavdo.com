"use client";

import { useMemo, useState } from "react";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, TextField } from "@sofsavdo/ui";
import { Plus, Trash2, Wand2 } from "lucide-react";
import type { DeliveryRegionInput } from "@/lib/api/admin";
import {
  useCreateDeliveryRegion,
  useDeleteDeliveryRegion,
  useDeliveryRegions,
  useSeedStandardDeliveryRegions,
  useUpdateDeliveryRegion,
} from "@/services/admin/delivery";
import { ApiError } from "@/lib/api/admin";
import { getStandardFeeMinor, UZ_VILOYATLAR, zonesByViloyat } from "@/lib/uz-regions";

const EMPTY_FORM: DeliveryRegionInput = { regionCode: "", regionName: "", feeType: "FREE", deliveryFeeMinor: 0 };

// Only rendered for PHYSICAL_PRODUCT offers (see the offer detail page) — delivery regions are
// meaningless for COURSE/DIGITAL/SERVICE offers, and the backend rejects them anyway
// (PRODUCT_NOT_PHYSICAL).
//
// Region entry used to be two free-text inputs (regionCode/regionName), meaning an admin had to
// type out every delivery zone by hand, per offer — real friction reported directly. The "Standart
// narxlarni qo'llash" button below is the actual fix for that: one click bulk-seeds every
// canonical Uzbekistan zone (Toshkent shahar free, every other viloyat's own center + every
// tuman/shahar within it) at the standard two-tier pricing. The manual add-form below it still
// exists for the genuine one-off case (a specific offer needs a different price for one region,
// or a zone this list doesn't cover) — but it's now a real viloyat->tuman/shahar picklist instead
// of free text, so at least the name/code can never be misspelled or drift from the canonical list.
export function DeliveryRegionsManager({ offerId }: { offerId: string }) {
  const regionsQuery = useDeliveryRegions(offerId);
  const createMutation = useCreateDeliveryRegion(offerId);
  const updateMutation = useUpdateDeliveryRegion(offerId);
  const deleteMutation = useDeleteDeliveryRegion(offerId);
  const seedMutation = useSeedStandardDeliveryRegions(offerId);

  const [form, setForm] = useState<DeliveryRegionInput>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [viloyatCode, setViloyatCode] = useState(UZ_VILOYATLAR[0]!.code);

  const zonesInViloyat = useMemo(() => zonesByViloyat(viloyatCode), [viloyatCode]);

  const regions = regionsQuery.data ?? [];
  const error =
    (createMutation.error as ApiError | null) ??
    (updateMutation.error as ApiError | null) ??
    (deleteMutation.error as ApiError | null) ??
    (seedMutation.error as ApiError | null);

  function applyZone(zoneCode: string) {
    const zone = zonesInViloyat.find((z) => z.code === zoneCode);
    if (!zone) return;
    setForm({
      regionCode: zone.code,
      regionName: zone.name,
      feeType: zone.kind === "FREE" ? "FREE" : "FIXED",
      deliveryFeeMinor: getStandardFeeMinor(zone.kind),
    });
  }

  async function handleCreate() {
    await createMutation.mutateAsync(form);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Yetkazib berish hududlari</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Toshkent shahar — bepul, viloyat markazlari — 35 000 so&apos;m, tumanlar — 45 000 so&apos;m.
        </p>
      </CardHeader>

      {error ? <Alert tone="error" className="mb-3">{error.message}</Alert> : null}

      <Button
        type="button"
        size="sm"
        className="mb-3 w-fit"
        disabled={seedMutation.isPending}
        onClick={() => seedMutation.mutate(undefined)}
      >
        <Wand2 className="mr-1.5 size-4" />
        {seedMutation.isPending ? "Qo'llanmoqda..." : "Standart narxlarni qo'llash (barcha hududlar)"}
      </Button>

      {regions.length === 0 ? (
        <p className="mb-3 font-body text-sm text-text-muted">Hozircha region sozlanmagan.</p>
      ) : (
        <ul className="mb-3 max-h-96 divide-y divide-border overflow-y-auto rounded-input border border-border">
          {regions.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 p-2.5">
              <div>
                <p className="font-body text-sm text-text-primary">{r.regionName}</p>
                <p className="font-body text-xs text-text-muted">
                  {r.feeType === "FREE" ? "Bepul" : formatMoneyMinor(r.deliveryFeeMinor, r.currency)}
                  {r.estimatedMinDays != null ? ` · ${r.estimatedMinDays}${r.estimatedMaxDays && r.estimatedMaxDays !== r.estimatedMinDays ? `–${r.estimatedMaxDays}` : ""} kun` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Faol" : "Nofaol"}</Badge>
                <Badge tone={r.availability === "AVAILABLE" ? "info" : "warning"}>
                  {r.availability === "AVAILABLE" ? "Mavjud" : "Mavjud emas"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: r.id, input: { active: !r.active } })}
                >
                  {r.active ? "O'chirish" : "Yoqish"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-error hover:bg-error/10"
                  onClick={() => deleteMutation.mutate(r.id)}
                  aria-label="Butunlay o'chirish"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <div className="space-y-3 rounded-input border border-border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="viloyat" className="mb-1 block font-body text-xs text-text-muted">
                Viloyat
              </label>
              <select
                id="viloyat"
                value={viloyatCode}
                onChange={(e) => {
                  setViloyatCode(e.target.value);
                  const firstZone = zonesByViloyat(e.target.value)[0];
                  if (firstZone) applyZone(firstZone.code);
                }}
                className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm"
              >
                {UZ_VILOYATLAR.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tuman" className="mb-1 block font-body text-xs text-text-muted">
                Tuman / shahar
              </label>
              <select
                id="tuman"
                value={form.regionCode}
                onChange={(e) => applyZone(e.target.value)}
                disabled={zonesInViloyat.length <= 1}
                className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm disabled:opacity-60"
              >
                {zonesInViloyat.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fee-type" className="mb-1 block font-body text-xs text-text-muted">
                Yetkazib berish turi
              </label>
              <select
                id="fee-type"
                value={form.feeType}
                onChange={(e) => setForm({ ...form, feeType: e.target.value as "FREE" | "FIXED" })}
                className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm"
              >
                <option value="FREE">Bepul</option>
                <option value="FIXED">Belgilangan narx</option>
              </select>
            </div>
            {form.feeType === "FIXED" ? (
              <TextField
                label="Narx (so'm)"
                type="number"
                value={String((form.deliveryFeeMinor ?? 0) / 100)}
                onChange={(e) => setForm({ ...form, deliveryFeeMinor: Math.round(Number(e.target.value) * 100) })}
              />
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Minimal kun"
              type="number"
              value={form.estimatedMinDays != null ? String(form.estimatedMinDays) : ""}
              onChange={(e) => setForm({ ...form, estimatedMinDays: e.target.value ? Number(e.target.value) : undefined })}
            />
            <TextField
              label="Maksimal kun"
              type="number"
              value={form.estimatedMaxDays != null ? String(form.estimatedMaxDays) : ""}
              onChange={(e) => setForm({ ...form, estimatedMaxDays: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={createMutation.isPending || !form.regionCode || !form.regionName} onClick={handleCreate}>
              {createMutation.isPending ? "Saqlanmoqda..." : "Qo'shish"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Bekor qilish
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const firstZone = zonesByViloyat(viloyatCode)[0];
            if (firstZone) applyZone(firstZone.code);
            setShowForm(true);
          }}
        >
          <Plus className="mr-1.5 size-4" /> Bitta hudud narxini alohida sozlash
        </Button>
      )}
    </Card>
  );
}
