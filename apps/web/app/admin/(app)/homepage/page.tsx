"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton } from "@sofsavdo/ui";
import { ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import {
  useAddHomepageSection,
  useAdminHomepageSections,
  useRemoveHomepageSection,
  useReorderHomepageSections,
  useToggleHomepageSection,
  useUpdateHomepageSection,
} from "@/services/admin/homepage";
import { HomepageSectionEditor } from "@/components/admin/HomepageSectionEditor";
import { ALL_HOMEPAGE_SECTION_TYPES, HOMEPAGE_SECTION_TYPE_LABELS } from "@/components/admin/homepageSectionTypeConfig";
import type { HomepageSectionType } from "@/lib/api/admin";

// Flat — unlike the Landing builder (apps/web/app/admin/(app)/landings/[id]/page.tsx), there is no
// offerId to nest under and no draft/published/archived workflow: the homepage is always live, so
// there is no publish/unpublish/archive action here, and no preview-iframe distinct from the real
// page — "Ochiq sahifa" below just links to `/` itself (see DECISIONS.md ADR-027).
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HomepageBuilderPage() {
  const sectionsQuery = useAdminHomepageSections();
  const addSection = useAddHomepageSection();
  const toggleSection = useToggleHomepageSection();
  const removeSection = useRemoveHomepageSection();
  const reorderSections = useReorderHomepageSections();
  const updateSection = useUpdateHomepageSection();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newType, setNewType] = useState<HomepageSectionType>("BANNER");

  if (sectionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (sectionsQuery.isError) return <Alert tone="error">Homepage sectionlarini yuklashda xatolik yuz berdi.</Alert>;

  const sections = [...(sectionsQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    reorderSections.mutate(reordered.map((s) => s.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Homepage CMS</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/" target="_blank">
            <ExternalLink className="mr-1.5 size-4" /> Ochiq sahifa
          </Link>
        </Button>
      </div>

      {sections.length === 0 ? (
        <Alert tone="info">
          Hali hech qanday homepage section qo&apos;shilmagan — sahifa hozircha standart (fixed) ko&apos;rinishda ishlaydi. Quyidan
          section qo&apos;shing.
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Sectionlar ({sections.length})</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-2">
          {sections.map((section, i) => (
            <div key={section.id} className="rounded-input border border-border">
              <div className="flex items-center gap-1.5 p-2.5">
                <div className="flex flex-col">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-text-muted disabled:opacity-30">
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="text-text-muted disabled:opacity-30">
                    <ChevronDown className="size-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
                  className="flex-1 text-left font-body text-sm text-text-primary"
                >
                  {HOMEPAGE_SECTION_TYPE_LABELS[section.type]}
                </button>
                {!section.isActive ? <Badge tone="neutral">Nofaol</Badge> : null}
                <button
                  type="button"
                  onClick={() => toggleSection.mutate({ id: section.id, nextIsActive: !section.isActive })}
                  className="rounded-input p-1.5 text-text-muted hover:bg-bg"
                  aria-label="Faollikni almashtirish"
                >
                  {section.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                <button type="button" onClick={() => removeSection.mutate(section.id)} className="rounded-input p-1.5 text-error hover:bg-error/10" aria-label="O'chirish">
                  <Trash2 className="size-4" />
                </button>
              </div>
              {expandedId === section.id ? (
                <div className="space-y-4 border-t border-border p-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 font-body text-sm text-text-secondary">
                      Boshlanish vaqti (ixtiyoriy)
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocal(section.startsAt)}
                        onBlur={(e) => updateSection.mutate({ id: section.id, patch: { startsAt: e.target.value ? new Date(e.target.value).toISOString() : null } })}
                        className="h-9 rounded-input border border-border bg-surface px-2 font-body text-sm"
                      />
                    </label>
                    <label className="flex flex-col gap-1 font-body text-sm text-text-secondary">
                      Tugash vaqti (ixtiyoriy)
                      <input
                        type="datetime-local"
                        defaultValue={toDatetimeLocal(section.expiresAt)}
                        onBlur={(e) => updateSection.mutate({ id: section.id, patch: { expiresAt: e.target.value ? new Date(e.target.value).toISOString() : null } })}
                        className="h-9 rounded-input border border-border bg-surface px-2 font-body text-sm"
                      />
                    </label>
                  </div>
                  <HomepageSectionEditor
                    section={section}
                    isPending={updateSection.isPending}
                    onSave={(content) => updateSection.mutate({ id: section.id, patch: { content } })}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as HomepageSectionType)}
            className="h-9 flex-1 rounded-input border border-border bg-surface px-2 font-body text-sm"
          >
            {ALL_HOMEPAGE_SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {HOMEPAGE_SECTION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={() => addSection.mutate(newType)} disabled={addSection.isPending}>
            <Plus className="mr-1.5 size-4" /> Qo&apos;shish
          </Button>
        </div>
      </Card>

      <Alert tone="info">
        O&apos;zgarishlar darhol jonli sahifada ko&apos;rinadi — bu yerda alohida &quot;e&apos;lon qilish&quot; qadami yo&apos;q
        (homepage har doim jonli). Har bir sectionning ko&apos;rinishini &quot;Faollik&quot; tugmasi orqali istalgan vaqt
        yoqish/o&apos;chirish mumkin.
      </Alert>
    </div>
  );
}
