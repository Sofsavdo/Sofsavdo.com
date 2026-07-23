"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardHeader, CardTitle, ConfirmModal, Skeleton, StatusBadge, TextAreaField, TextField, cn } from "@rosti/ui";
import { Archive, ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, Monitor, Plus, Send, Smartphone, Trash2, Undo2 } from "lucide-react";
import {
  useAddLandingSection,
  useAdminLanding,
  useAdminLandingSections,
  useAdminOffer,
  useArchiveLanding,
  useCreateLanding,
  usePublishLanding,
  useRemoveLandingSection,
  useReorderLandingSections,
  useToggleLandingSection,
  useUnpublishLanding,
  useUpdateLanding,
  useUpdateLandingSection,
} from "@/services/admin/catalog";
import { SectionEditor } from "@/components/admin/SectionEditor";
import { ALL_SECTION_TYPES, SECTION_TYPE_LABELS } from "@/components/admin/sectionTypeConfig";
import { landingStatusMeta } from "@/lib/status";
import type { LandingSectionType } from "@rosti/types";

// Mirrors LandingsService's ALLOWED_TRANSITIONS on the backend — a UX convenience only, the
// server re-checks every transition regardless (see landings.service.ts).
const ALLOWED_NEXT_ACTIONS: Record<string, Array<"publish" | "unpublish" | "archive">> = {
  DRAFT: ["publish", "archive"],
  PUBLISHED: ["unpublish", "archive"],
  ARCHIVED: [],
};

export default function LandingBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: offerId } = use(params);
  const offerQuery = useAdminOffer(offerId);
  const landingQuery = useAdminLanding(offerId);
  const sectionsQuery = useAdminLandingSections(offerId);
  const createLanding = useCreateLanding();
  const updateLanding = useUpdateLanding(offerId);
  const publishLanding = usePublishLanding();
  const unpublishLanding = useUnpublishLanding();
  const archiveLandingMut = useArchiveLanding();
  const addSection = useAddLandingSection();
  const toggleSection = useToggleLandingSection(offerId);
  const removeSection = useRemoveLandingSection(offerId);
  const reorderSections = useReorderLandingSections(offerId);
  const updateSection = useUpdateLandingSection(offerId);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newType, setNewType] = useState<LandingSectionType>("BENEFITS");
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");

  if (offerQuery.isLoading || landingQuery.isLoading || sectionsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const offer = offerQuery.data;
  if (!offer) return <Alert tone="error">Offer topilmadi.</Alert>;

  const landing = landingQuery.data;

  if (!landing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 font-body text-sm text-text-secondary">
          <Link href="/admin/landings" className="hover:text-text-primary">
            Landing sahifalar
          </Link>
          <span>/</span>
          <span className="text-text-primary">{offer.name}</span>
        </div>
        <Alert tone="info">
          Bu offer uchun hali landing sahifa yaratilmagan.
          <div className="mt-3">
            <Button size="sm" disabled={createLanding.isPending} onClick={() => createLanding.mutate({ offerId, input: {} })}>
              Landing sahifa yaratish
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const sections = [...(sectionsQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeSections = sections.filter((s) => s.isActive);
  const nextActions = ALLOWED_NEXT_ACTIONS[landing.status] ?? [];

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    reorderSections.mutate(reordered.map((s) => s.id));
  }

  function saveSeo() {
    updateLanding.mutate({
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
      ogImageUrl: ogImageUrl || undefined,
    });
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-text-primary">Landing builder — {offer.name}</h1>
          <StatusBadge tone={landingStatusMeta[landing.status].tone} label={landingStatusMeta[landing.status].label} />
        </div>
        <div className="flex items-center gap-2">
          {nextActions.includes("publish") ? (
            <Button variant="outline" size="sm" disabled={publishLanding.isPending} onClick={() => publishLanding.mutate(offerId)}>
              <Send className="mr-1.5 size-4" /> E&apos;lon qilish
            </Button>
          ) : null}
          {nextActions.includes("unpublish") ? (
            <Button variant="outline" size="sm" disabled={unpublishLanding.isPending} onClick={() => unpublishLanding.mutate(offerId)}>
              <Undo2 className="mr-1.5 size-4" /> Qoralamaga qaytarish
            </Button>
          ) : null}
          {nextActions.includes("archive") ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
              <Archive className="mr-1.5 size-4" /> Arxivlash
            </Button>
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/landings/${offerId}/preview`} target="_blank">
              <Eye className="mr-1.5 size-4" /> Preview
            </Link>
          </Button>
          {landing.status === "PUBLISHED" ? (
            <Button asChild size="sm">
              <Link href={`/o/${offer.slug}`} target="_blank">
                <ExternalLink className="mr-1.5 size-4" /> Ochiq sahifa
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={async () => {
          await archiveLandingMut.mutateAsync(offerId);
          setConfirmArchive(false);
        }}
        title="Landing sahifani arxivlash"
        description="Arxivlangan landing sahifa qayta e'lon qilinmaydi va ochiq URL 404 qaytaradi. Davom etishga ishonchingiz komilmi?"
        confirmLabel="Arxivlash"
        destructive
        isPending={archiveLandingMut.isPending}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3">
              <TextField
                label="SEO sarlavha"
                defaultValue={landing.seoTitle ?? ""}
                onChange={(e) => setSeoTitle(e.target.value)}
                disabled={landing.status === "ARCHIVED"}
              />
              <TextAreaField
                label="SEO tavsif"
                defaultValue={landing.seoDescription ?? ""}
                onChange={(e) => setSeoDescription(e.target.value)}
                disabled={landing.status === "ARCHIVED"}
              />
              <TextField
                label="OpenGraph rasm URL"
                defaultValue={landing.ogImageUrl ?? ""}
                onChange={(e) => setOgImageUrl(e.target.value)}
                disabled={landing.status === "ARCHIVED"}
              />
              <Button type="button" size="sm" className="w-fit" disabled={updateLanding.isPending || landing.status === "ARCHIVED"} onClick={saveSeo}>
                SEO saqlash
              </Button>
            </div>
          </Card>

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
                    layout. An iframe gets its own real viewport equal to its rendered width. Points
                    at the admin-authenticated preview route (not /o/[slug]) so a DRAFT landing
                    still renders here — the real public route now correctly 404s anything
                    unpublished. */}
                <iframe
                  key={`${offerId}-${viewport}`}
                  src={`/admin/landings/${offerId}/preview`}
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
