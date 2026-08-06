"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, Plus, Trash2 } from "lucide-react";
import type { LandingSectionType } from "@sofsavdo/types";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, IconButton, SelectField, Skeleton } from "@sofsavdo/ui";
import {
  useAdminLandingSections,
  useAddLandingSection,
  useUpdateLandingSection,
  useToggleLandingSection,
  useRemoveLandingSection,
  useReorderLandingSections,
} from "@/services/admin/catalog";
import { SectionEditor } from "@/components/admin/SectionEditor";
import { ALL_SECTION_TYPES, SECTION_TYPE_LABELS } from "@/components/admin/sectionTypeConfig";

// The section-management screen for an Offer's landing page. The pieces this assembles (the
// admin CRUD hooks in services/admin/catalog.ts, the API controller, and SectionEditor's
// per-type content forms) already existed and were fully wired end-to-end — there was simply no
// admin route that put them together, so an admin had no way to reach this at all short of
// hand-typing a URL to the read-only /admin/landings/[id]/preview page. `[id]` here is the
// Offer id, matching that preview route's own param naming.
export default function LandingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = use(params);
  const query = useAdminLandingSections(offerId);
  const addSection = useAddLandingSection();
  const updateSection = useUpdateLandingSection(offerId);
  const toggleSection = useToggleLandingSection(offerId);
  const removeSection = useRemoveLandingSection(offerId);
  const reorderSections = useReorderLandingSections(offerId);

  const [newType, setNewType] = useState<LandingSectionType>("CUSTOM_RICH_TEXT");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const sections = [...(query.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    const tmp = reordered[index]!;
    reordered[index] = reordered[target]!;
    reordered[target] = tmp;
    reorderSections.mutate(reordered.map((s) => s.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/admin/products" className="hover:text-text-primary">
          Products
        </Link>
        <span>/</span>
        <span className="text-text-primary">Landing sahifa</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Landing sahifani tahrirlash</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/landings/${offerId}/preview`} target="_blank">
            <Eye className="mr-1.5 size-4" /> Ko&apos;rib chiqish
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Yangi bo&apos;lim qo&apos;shish</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Bo'lim turi"
            value={newType}
            onChange={(e) => setNewType(e.target.value as LandingSectionType)}
            className="min-w-[220px]"
          >
            {ALL_SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SECTION_TYPE_LABELS[t]}
              </option>
            ))}
          </SelectField>
          <Button size="sm" disabled={addSection.isPending} onClick={() => addSection.mutate({ offerId, type: newType })}>
            <Plus className="mr-1.5 size-4" /> Qo&apos;shish
          </Button>
        </div>
      </Card>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : sections.length === 0 ? (
        <Alert tone="warning">
          Hali birorta bo&apos;lim qo&apos;shilmagan — buyer sahifasi faqat asosiy (Hero/Narx/CTA) qismlarni ko&apos;rsatadi.
        </Alert>
      ) : (
        <div className="space-y-3">
          {sections.map((section, index) => (
            <Card key={section.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <IconButton aria-label="Yuqoriga ko'chirish" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp className="size-4" />
                    </IconButton>
                    <IconButton
                      aria-label="Pastga ko'chirish"
                      size="sm"
                      disabled={index === sections.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </IconButton>
                  </div>
                  <div>
                    <p className="font-body text-sm font-medium text-text-primary">{SECTION_TYPE_LABELS[section.type]}</p>
                    <Badge tone={section.isActive ? "success" : "neutral"}>{section.isActive ? "Faol" : "Nofaol"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggleSection.isPending}
                    onClick={() => toggleSection.mutate({ id: section.id, nextIsActive: !section.isActive })}
                  >
                    {section.isActive ? "O'chirish" : "Yoqish"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedId((cur) => (cur === section.id ? null : section.id))}>
                    {expandedId === section.id ? "Yopish" : "Tahrirlash"}
                  </Button>
                  <IconButton aria-label="Bo'limni o'chirish" size="sm" onClick={() => setConfirmRemoveId(section.id)}>
                    <Trash2 className="size-4 text-error" />
                  </IconButton>
                </div>
              </div>
              {expandedId === section.id ? (
                <div className="mt-4 border-t border-border pt-4">
                  <SectionEditor
                    section={section}
                    isPending={updateSection.isPending}
                    onSave={(content) => updateSection.mutate({ id: section.id, patch: { content } })}
                  />
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmRemoveId}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={async () => {
          if (confirmRemoveId) await removeSection.mutateAsync(confirmRemoveId);
          setConfirmRemoveId(null);
        }}
        title="Bo'limni o'chirish"
        description="Bu bo'lim butunlay o'chiriladi va buyer sahifasidan yo'qoladi."
        confirmLabel="O'chirish"
        destructive
        isPending={removeSection.isPending}
      />
    </div>
  );
}
