"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, Skeleton, cn } from "@rosti/ui";
import { ChevronDown, ChevronUp, Eye, EyeOff, Monitor, Plus, Smartphone, Trash2 } from "lucide-react";
import {
  useAddLandingSection,
  useAdminLandingSections,
  useAdminOffer,
  useRemoveLandingSection,
  useReorderLandingSections,
  useToggleLandingSection,
  useUpdateLandingSection,
} from "@/services/admin/catalog";
import { SectionEditor } from "@/components/admin/SectionEditor";
import { ALL_SECTION_TYPES, SECTION_TYPE_LABELS } from "@/components/admin/sectionTypeConfig";
import type { LandingSectionType } from "@rosti/types";

export default function LandingBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = use(params);
  const offerQuery = useAdminOffer(offerId);
  const sectionsQuery = useAdminLandingSections(offerId);
  const addSection = useAddLandingSection();
  const toggleSection = useToggleLandingSection(offerId);
  const removeSection = useRemoveLandingSection(offerId);
  const reorderSections = useReorderLandingSections(offerId);
  const updateSection = useUpdateLandingSection(offerId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newType, setNewType] = useState<LandingSectionType>("BENEFITS");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  if (offerQuery.isLoading || sectionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const offer = offerQuery.data;
  if (!offer) return <Alert tone="error">Offer topilmadi.</Alert>;

  const sections = [...(sectionsQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeSections = sections.filter((s) => s.isActive);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    reorderSections.mutate(reordered.map((s) => s.id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
        <Link href="/admin/landings" className="hover:text-text-primary">
          Landing sahifalar
        </Link>
        <span>/</span>
        <span className="text-text-primary">{offer.name}</span>
      </div>

      <h1 className="font-heading text-2xl font-bold text-text-primary">Landing builder — {offer.name}</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
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
                      {SECTION_TYPE_LABELS[section.type]}
                    </button>
                    {!section.isActive ? <Badge tone="neutral">Nofaol</Badge> : null}
                    <button type="button" onClick={() => toggleSection.mutate(section.id)} className="rounded-input p-1.5 text-text-muted hover:bg-bg" aria-label="Faollikni almashtirish">
                      {section.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                    <button type="button" onClick={() => removeSection.mutate(section.id)} className="rounded-input p-1.5 text-error hover:bg-error/10" aria-label="O'chirish">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  {expandedId === section.id ? (
                    <div className="border-t border-border p-3">
                      <SectionEditor
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
                onChange={(e) => setNewType(e.target.value as LandingSectionType)}
                className="h-9 flex-1 rounded-input border border-border bg-surface px-2 font-body text-sm"
              >
                {ALL_SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SECTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" onClick={() => addSection.mutate({ offerId, type: newType })} disabled={addSection.isPending}>
                <Plus className="mr-1.5 size-4" /> Qo&apos;shish
              </Button>
            </div>
          </Card>

          <Alert tone="info">
            Bu builderda faqat matn/rasm-nomi/ro&apos;yxat kiritiladi — erkin CSS yoki JavaScript kiritish imkoni yo&apos;q, shu
            bilan landing xavfsiz va boshqa offerlarga havola bermaydigan holatda qoladi.
          </Alert>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Preview</CardTitle>
            <div className="flex gap-1 rounded-input bg-bg p-1">
              <button type="button" onClick={() => setViewport("desktop")} className={cn("rounded-input p-1.5", viewport === "desktop" ? "bg-surface shadow-sm" : "")}>
                <Monitor className="size-4" />
              </button>
              <button type="button" onClick={() => setViewport("mobile")} className={cn("rounded-input p-1.5", viewport === "mobile" ? "bg-surface shadow-sm" : "")}>
                <Smartphone className="size-4" />
              </button>
            </div>
          </div>
          <div className="rounded-card border border-border bg-bg p-4">
            {activeSections.length === 0 ? (
              <p className="p-8 text-center font-body text-sm text-text-muted">Faol section yo&apos;q.</p>
            ) : (
              <div className={cn("mx-auto overflow-hidden rounded-card border border-border bg-surface", viewport === "mobile" ? "w-[390px]" : "w-full")}>
                {/* A real iframe, not a width-constrained div — Tailwind's `md:` breakpoints key off
                    actual viewport width, so a CSS-narrowed container alone never triggers mobile
                    layout. An iframe gets its own real viewport equal to its rendered width, so this
                    is the same production /o/[offerSlug] page genuinely reflowing to mobile. */}
                <iframe
                  key={`${offer.slug}-${viewport}`}
                  src={`/o/${offer.slug}`}
                  title="Landing preview"
                  className="h-[80vh] w-full border-0"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
