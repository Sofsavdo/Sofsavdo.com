"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, CardHeader, CardTitle, TextAreaField, TextField } from "@sofsavdo/ui";
import { Sparkles } from "lucide-react";
import { generateProductDraft, type ProductAiDraft } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/admin";

// The AI Product Creation Engine's admin-facing entry point (Sofsavdo architecture review, Part 1
// §3) — draft-only, never auto-saved. "Ishlatish" hands the full draft up to the caller (the
// Product Launch Wizard), which decides what to do with each field: Product gets title/
// shortDescription (see ProductForm's own `aiDraft` prop), the Landing scaffold step gets
// benefits/faq content instead of empty sections. Nothing here writes to the database directly.
export function ProductAiDraftPanel({ onUse }: { onUse: (draft: ProductAiDraft) => void }) {
  const [productName, setProductName] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [imageUrlsText, setImageUrlsText] = useState("");
  const [draft, setDraft] = useState<ProductAiDraft | null>(null);
  const [used, setUsed] = useState(false);

  const generate = useMutation({
    mutationFn: () => {
      const imageUrls = imageUrlsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      return generateProductDraft({ productName: productName || undefined, shortDescription: shortDescription || undefined, imageUrls });
    },
    onSuccess: (result) => {
      setDraft(result);
      setUsed(false);
    },
  });

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" /> AI bilan qoralama yaratish (ixtiyoriy)
        </CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Mahsulot nomi, qisqacha izoh va/yoki rasm havolalari asosida qoralama matn tayyorlanadi — hech narsa avtomatik
          saqlanmaydi, faqat &quot;Ishlatish&quot;ni bosgandan keyin quyidagi shakllarga o&apos;tkazasiz va tekshirib
          saqlaysiz.
        </p>
      </CardHeader>

      <div className="flex flex-col gap-3">
        <TextField label="Mahsulot nomi (ixtiyoriy)" value={productName} onChange={(e) => setProductName(e.target.value)} />
        <TextAreaField
          label="Qisqacha izoh (ixtiyoriy)"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          placeholder="Masalan: paxta ko'ylak, yozgi, erkaklar uchun"
        />
        <TextAreaField
          label="Rasm havolalari (ixtiyoriy, har birini yangi qatordan)"
          value={imageUrlsText}
          onChange={(e) => setImageUrlsText(e.target.value)}
        />

        {generate.isError ? (
          <Alert tone="error">
            {generate.error instanceof ApiError && generate.error.code === "AI_NOT_CONFIGURED"
              ? "AI xizmati sozlanmagan (ANTHROPIC_API_KEY yo'q) — mahsulotni qo'lda kiritishda davom eting."
              : generate.error instanceof Error
                ? generate.error.message
                : "Qoralama yaratishda xatolik yuz berdi."}
          </Alert>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={generate.isPending || (!productName && !shortDescription && !imageUrlsText.trim())}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? "Yaratilmoqda..." : "Qoralama yaratish"}
        </Button>

        {draft ? (
          <div className="flex flex-col gap-3 rounded-input border border-border p-4">
            <div>
              <p className="font-body text-xs font-semibold uppercase text-text-muted">Sarlavha</p>
              <p className="font-body text-sm text-text-primary">{draft.title}</p>
            </div>
            <div>
              <p className="font-body text-xs font-semibold uppercase text-text-muted">Qisqacha tavsif</p>
              <p className="font-body text-sm text-text-primary">{draft.shortDescription}</p>
            </div>
            <div>
              <p className="font-body text-xs font-semibold uppercase text-text-muted">To&apos;liq tavsif</p>
              <p className="whitespace-pre-wrap font-body text-sm text-text-secondary">{draft.description}</p>
            </div>
            {draft.features.length ? (
              <div>
                <p className="font-body text-xs font-semibold uppercase text-text-muted">Xususiyatlar</p>
                <ul className="list-inside list-disc font-body text-sm text-text-secondary">
                  {draft.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draft.benefits.length ? (
              <div>
                <p className="font-body text-xs font-semibold uppercase text-text-muted">Foydalar</p>
                <ul className="list-inside list-disc font-body text-sm text-text-secondary">
                  {draft.benefits.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {draft.faq.length ? (
              <div>
                <p className="font-body text-xs font-semibold uppercase text-text-muted">FAQ</p>
                <ul className="flex flex-col gap-1 font-body text-sm text-text-secondary">
                  {draft.faq.map((f, i) => (
                    <li key={i}>
                      <span className="font-medium text-text-primary">{f.question}</span> — {f.answer}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              className="w-fit"
              onClick={() => {
                onUse(draft);
                setUsed(true);
              }}
            >
              {used ? "Ishlatildi ✓" : "Ishlatish — shakllarga o'tkazish"}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
