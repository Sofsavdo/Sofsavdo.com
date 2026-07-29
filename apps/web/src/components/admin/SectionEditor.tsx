"use client";

import { useState } from "react";
import type { LandingSectionAdmin } from "@sofsavdo/types";
import { Button, TextAreaField, TextField } from "@sofsavdo/ui";
import { Plus, Trash2 } from "lucide-react";
import { SECTION_TYPE_SHAPE } from "./sectionTypeConfig";

type Step = { step: string; text: string };
type Review = { author: string; rating: number; text: string };
type FaqItem = { q: string; a: string };

export function SectionEditor({
  section,
  onSave,
  isPending,
}: {
  section: LandingSectionAdmin;
  onSave: (content: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const shape = SECTION_TYPE_SHAPE[section.type];
  const content = section.content as Record<string, unknown>;

  const [text, setText] = useState((content.text as string) ?? "");
  const [caption, setCaption] = useState((content.caption as string) ?? "");
  const [items, setItems] = useState(((content.items as string[]) ?? []).join("\n"));
  const [images, setImages] = useState(((content.images as string[]) ?? []).join("\n"));
  const [steps, setSteps] = useState<Step[]>((content.steps as Step[]) ?? [{ step: "1", text: "" }]);
  const [reviews, setReviews] = useState<Review[]>((content.reviews as Review[]) ?? [{ author: "", rating: 5, text: "" }]);
  const [faq, setFaq] = useState<FaqItem[]>((content.items as FaqItem[]) ?? [{ q: "", a: "" }]);

  if (shape === "none") {
    return (
      <p className="font-body text-sm text-text-muted">
        Bu section Offer ma&apos;lumotlaridan avtomatik to&apos;ldiriladi (narx, variantlar, CTA) — alohida tahrirlanmaydi.
      </p>
    );
  }

  function save() {
    switch (shape) {
      case "text":
        return onSave({ text });
      case "caption":
        return onSave({ caption });
      case "items":
        return onSave({ items: items.split("\n").map((s) => s.trim()).filter(Boolean) });
      case "images":
        return onSave({ images: images.split("\n").map((s) => s.trim()).filter(Boolean) });
      case "steps":
        return onSave({ steps });
      case "reviews":
        return onSave({ reviews });
      case "faq":
        return onSave({ items: faq });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {shape === "text" ? <TextAreaField label="Matn" value={text} onChange={(e) => setText(e.target.value)} /> : null}
      {shape === "caption" ? <TextField label="Izoh" value={caption} onChange={(e) => setCaption(e.target.value)} /> : null}
      {shape === "items" ? (
        <TextAreaField label="Har birini yangi qatordan kiriting" value={items} onChange={(e) => setItems(e.target.value)} />
      ) : null}
      {shape === "images" ? (
        <TextAreaField label="Rasm nomlari (har birini yangi qatordan)" value={images} onChange={(e) => setImages(e.target.value)} />
      ) : null}

      {shape === "steps" ? (
        <div className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={s.step}
                onChange={(e) => setSteps((list) => list.map((x, idx) => (idx === i ? { ...x, step: e.target.value } : x)))}
                className="h-9 w-14 rounded-input border border-border bg-surface px-2 text-center font-body text-sm"
                placeholder="#"
              />
              <input
                value={s.text}
                onChange={(e) => setSteps((list) => list.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                className="h-9 flex-1 rounded-input border border-border bg-surface px-3 font-body text-sm"
                placeholder="Qadam tavsifi"
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setSteps((list) => list.filter((_, idx) => idx !== i))}>
                <Trash2 className="size-4 text-error" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setSteps((list) => [...list, { step: String(list.length + 1), text: "" }])}>
            <Plus className="mr-1.5 size-4" /> Qadam qo&apos;shish
          </Button>
        </div>
      ) : null}

      {shape === "reviews" ? (
        <div className="flex flex-col gap-2">
          {reviews.map((r, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-input border border-border p-3 sm:grid-cols-[1fr_auto]">
              <input
                value={r.author}
                onChange={(e) => setReviews((list) => list.map((x, idx) => (idx === i ? { ...x, author: e.target.value } : x)))}
                className="h-9 rounded-input border border-border bg-surface px-3 font-body text-sm"
                placeholder="Muallif (masalan: Malika, Toshkent)"
              />
              <select
                value={r.rating}
                onChange={(e) => setReviews((list) => list.map((x, idx) => (idx === i ? { ...x, rating: Number(e.target.value) } : x)))}
                className="h-9 rounded-input border border-border bg-surface px-2 font-body text-sm"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} yulduz
                  </option>
                ))}
              </select>
              <textarea
                value={r.text}
                onChange={(e) => setReviews((list) => list.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)))}
                className="min-h-16 rounded-input border border-border bg-surface px-3 py-2 font-body text-sm sm:col-span-2"
                placeholder="Sharh matni"
              />
              <Button type="button" variant="ghost" size="sm" className="w-fit sm:col-span-2" onClick={() => setReviews((list) => list.filter((_, idx) => idx !== i))}>
                <Trash2 className="mr-1.5 size-4 text-error" /> O&apos;chirish
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setReviews((list) => [...list, { author: "", rating: 5, text: "" }])}>
            <Plus className="mr-1.5 size-4" /> Sharh qo&apos;shish
          </Button>
        </div>
      ) : null}

      {shape === "faq" ? (
        <div className="flex flex-col gap-2">
          {faq.map((f, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-input border border-border p-3">
              <input
                value={f.q}
                onChange={(e) => setFaq((list) => list.map((x, idx) => (idx === i ? { ...x, q: e.target.value } : x)))}
                className="h-9 rounded-input border border-border bg-surface px-3 font-body text-sm"
                placeholder="Savol"
              />
              <textarea
                value={f.a}
                onChange={(e) => setFaq((list) => list.map((x, idx) => (idx === i ? { ...x, a: e.target.value } : x)))}
                className="min-h-14 rounded-input border border-border bg-surface px-3 py-2 font-body text-sm"
                placeholder="Javob"
              />
              <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setFaq((list) => list.filter((_, idx) => idx !== i))}>
                <Trash2 className="mr-1.5 size-4 text-error" /> O&apos;chirish
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setFaq((list) => [...list, { q: "", a: "" }])}>
            <Plus className="mr-1.5 size-4" /> Savol qo&apos;shish
          </Button>
        </div>
      ) : null}

      <Button type="button" size="sm" className="w-fit" onClick={save} disabled={isPending}>
        {isPending ? "Saqlanmoqda..." : "Saqlash"}
      </Button>
    </div>
  );
}
