"use client";

import { useState } from "react";
import { formatMoneyMinor } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton, TextField } from "@sofsavdo/ui";
import { Plus } from "lucide-react";
import {
  useActivateReferralRule,
  useCreateReferralRule,
  useDeactivateReferralRule,
  useReferralRules,
} from "@/services/admin/referrals";
import type { ReferralRuleInput } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/admin";

const MILESTONE_LABELS: Record<string, string> = {
  FIRST_APPROVED_CAMPAIGN_APPLICATION: "Birinchi tasdiqlangan kampaniya arizasi",
  FIRST_APPROVED_CONTENT: "Birinchi tasdiqlangan kontent",
  FIRST_QUALIFIED_SALE: "Birinchi malakali sotuv",
  FIRST_APPROVED_COMMISSION: "Birinchi tasdiqlangan komissiya",
  MIN_CUMULATIVE_EARNINGS: "Minimal jami daromad",
};

const EMPTY_FORM: ReferralRuleInput = { name: "", rewardType: "MILESTONE_FIXED", milestoneType: "FIRST_APPROVED_CAMPAIGN_APPLICATION" };

export default function ReferralRulesPage() {
  const rulesQuery = useReferralRules();
  const createMutation = useCreateReferralRule();
  const activateMutation = useActivateReferralRule();
  const deactivateMutation = useDeactivateReferralRule();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ReferralRuleInput>(EMPTY_FORM);

  const error = (createMutation.error as ApiError | null) ?? (activateMutation.error as ApiError | null) ?? (deactivateMutation.error as ApiError | null);

  async function handleCreate() {
    await createMutation.mutateAsync(form);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Referral qoidalari</h1>
        <p className="font-body text-sm text-text-secondary">
          Creator-to-creator referral mukofot dasturlarini sozlash. Ro&apos;yxatdan o&apos;tishning o&apos;zi hech qachon mukofot bermaydi.
        </p>
      </div>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      {rulesQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          {(rulesQuery.data ?? []).length === 0 ? (
            <p className="font-body text-sm text-text-muted">Hozircha qoida yo&apos;q.</p>
          ) : (
            (rulesQuery.data ?? []).map((rule) => (
              <Card key={rule.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-body text-sm font-medium text-text-primary">{rule.name}</p>
                    <p className="font-body text-xs text-text-muted">
                      {rule.rewardType === "MILESTONE_FIXED"
                        ? `${MILESTONE_LABELS[rule.milestoneType ?? ""] ?? rule.milestoneType} — ${formatMoneyMinor(rule.fixedRewardMinor ?? 0, rule.currency)}`
                        : `${(rule.rewardRateBps ?? 0) / 100}% qualified earnings${rule.earningWindowDays ? ` (${rule.earningWindowDays} kun)` : ""}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={rule.active ? "success" : "neutral"}>{rule.active ? "Faol" : "Nofaol"}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => (rule.active ? deactivateMutation.mutate(rule.id) : activateMutation.mutate(rule.id))}
                    >
                      {rule.active ? "O'chirish" : "Yoqish"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Yangi qoida</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <TextField label="Nomi" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div>
              <label htmlFor="reward-type" className="mb-1 block font-body text-xs text-text-muted">
                Mukofot turi
              </label>
              <select
                id="reward-type"
                value={form.rewardType}
                onChange={(e) => setForm({ ...form, rewardType: e.target.value as "MILESTONE_FIXED" | "EARNINGS_PERCENTAGE" })}
                className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm"
              >
                <option value="MILESTONE_FIXED">Belgilangan (bir martalik, milestone)</option>
                <option value="EARNINGS_PERCENTAGE">Foizli (daromaddan)</option>
              </select>
            </div>
            {form.rewardType === "MILESTONE_FIXED" ? (
              <>
                <div>
                  <label htmlFor="milestone" className="mb-1 block font-body text-xs text-text-muted">
                    Milestone
                  </label>
                  <select
                    id="milestone"
                    value={form.milestoneType}
                    onChange={(e) => setForm({ ...form, milestoneType: e.target.value })}
                    className="h-10 w-full rounded-input border border-border bg-bg px-3 font-body text-sm"
                  >
                    {Object.entries(MILESTONE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <TextField
                  label="Mukofot summasi (so'm)"
                  type="number"
                  value={form.fixedRewardMinor != null ? String(form.fixedRewardMinor / 100) : ""}
                  onChange={(e) => setForm({ ...form, fixedRewardMinor: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined })}
                />
              </>
            ) : (
              <>
                <TextField
                  label="Foiz (%)"
                  type="number"
                  value={form.rewardRateBps != null ? String(form.rewardRateBps / 100) : ""}
                  onChange={(e) => setForm({ ...form, rewardRateBps: e.target.value ? Math.round(Number(e.target.value) * 100) : undefined })}
                />
                <TextField
                  label="Daromad oynasi (kun)"
                  type="number"
                  value={form.earningWindowDays != null ? String(form.earningWindowDays) : ""}
                  onChange={(e) => setForm({ ...form, earningWindowDays: e.target.value ? Number(e.target.value) : undefined })}
                />
              </>
            )}
            <div className="flex gap-2">
              <Button disabled={createMutation.isPending || !form.name} onClick={handleCreate}>
                {createMutation.isPending ? "Saqlanmoqda..." : "Yaratish"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Bekor qilish
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 size-4" /> Yangi qoida
        </Button>
      )}
    </div>
  );
}
