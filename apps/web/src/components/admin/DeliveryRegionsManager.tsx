"use client";

import { useState } from "react";
import { formatMoneyMinor } from "@rosti/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, TextField } from "@rosti/ui";
import { Plus, Trash2 } from "lucide-react";
import type { DeliveryRegionInput } from "@/lib/api/admin";
import { useCreateDeliveryRegion, useDeleteDeliveryRegion, useDeliveryRegions, useUpdateDeliveryRegion } from "@/services/admin/delivery";
import { ApiError } from "@/lib/api/admin";

const EMPTY_FORM: DeliveryRegionInput = { regionCode: "", regionName: "", feeType: "FREE", deliveryFeeMinor: 0 };

// Only rendered for PHYSICAL_PRODUCT offers (see the offer detail page) — delivery regions are
// meaningless for COURSE/DIGITAL/SERVICE offers, and the backend rejects them anyway
// (PRODUCT_NOT_PHYSICAL).
export function DeliveryRegionsManager({ offerId }: { offerId: string }) {
  const regionsQuery = useDeliveryRegions(offerId);
  const createMutation = useCreateDeliveryRegion(offerId);
  const updateMutation = useUpdateDeliveryRegion(offerId);
  const deleteMutation = useDeleteDeliveryRegion(offerId);

  const [form, setForm] = useState<DeliveryRegionInput>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const regions = regionsQuery.data ?? [];
  const error = (createMutation.error as ApiError | null) ?? (updateMutation.error as ApiError | null) ?? (deleteMutation.error as ApiError | null);

  async function handleCreate() {
    await createMutation.mutateAsync(form);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yetkazib berish hududlari</CardTitle>
      </CardHeader>

      {error ? <Alert tone="error" className="mb-3">{error.message}</Alert> : null}

      {regions.length === 0 ? (
        <p className="mb-3 font-body text-sm text-text-muted">Hozircha region sozlanmagan.</p>
      ) : (
        <ul className="mb-3 divide-y divide-border rounded-input border border-border">
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
            <TextField label="Region kodi" value={form.regionCode} onChange={(e) => setForm({ ...form, regionCode: e.target.value })} />
            <TextField label="Region nomi" value={form.regionName} onChange={(e) => setForm({ ...form, regionName: e.target.value })} />
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
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 size-4" /> Region qo&apos;shish
        </Button>
      )}
    </Card>
  );
}
