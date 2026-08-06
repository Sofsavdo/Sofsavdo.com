"use client";

import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { CreatorApplicationData, SocialPlatform } from "@sofsavdo/types";
import { Button, Card, CardHeader, CardTitle, TextField, TextAreaField, SelectField, Alert, ProgressBar, cn } from "@sofsavdo/ui";
import { Plus, Trash2 } from "lucide-react";
import { useResubmitApplication, useSubmitApplication, useUpdateApplication } from "@/services/application";

const STEP_TITLES = [
  "Shaxsiy ma'lumotlar",
  "Creator profili",
  "To'lov va tugatish",
];

const NICHE_OPTIONS = [
  "Go'zallik",
  "Turmush tarzi",
  "Texnologiya",
  "Ta'lim",
  "Ona va bola",
  "Ovqat va oshxona",
  "Moda",
  "Sport va sog'lom turmush",
];

const PLATFORM_OPTIONS: SocialPlatform[] = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "TELEGRAM"];

const STEP_FIELDS: (keyof CreatorApplicationData)[][] = [
  ["phone", "city"],
  ["audienceAgeRange", "audienceGeography", "audienceInterests"],
  [],
];

export function OnboardingWizard({
  initialData,
  initialStep,
  revisionNote,
  mode = "submit",
  applicantName,
}: {
  initialData: CreatorApplicationData;
  initialStep: number;
  revisionNote?: string;
  // "submit" (DRAFT's first-ever submission) and "resubmit" (from CHANGES_REQUESTED/REJECTED) are
  // distinct real-backend actions (see OnboardingPageClient) — mock mode's single apiSubmitApplication
  // handles both identically, so only the real branch actually differs.
  mode?: "submit" | "resubmit";
  // The account's own displayName, set once at registration (see useSession's `register`) — never
  // part of CreatorApplicationData, so the review summary can't `watch()` it as a form field.
  applicantName: string;
}) {
  const [step, setStep] = useState(Math.min(Math.max(initialStep, 1), STEP_TITLES.length));
  const [stepError, setStepError] = useState<string | null>(null);
  const updateApplication = useUpdateApplication();
  const submitApplication = useSubmitApplication();
  const resubmitApplication = useResubmitApplication();
  const finalizeApplication = mode === "resubmit" ? resubmitApplication : submitApplication;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<CreatorApplicationData>({
    defaultValues: {
      contentNiches: [],
      socialAccounts: [],
      payoutMethodType: "CARD",
      termsAccepted: false,
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "socialAccounts" as never });
  const contentNiches = watch("contentNiches") ?? [];
  const payoutMethodType = watch("payoutMethodType");
  const termsAccepted = watch("termsAccepted");

  async function persist(currentStep: number) {
    const values = watch();
    await updateApplication.mutateAsync({ patch: values, step: currentStep });
    return values;
  }

  async function goNext() {
    setStepError(null);
    const fieldsToValidate = STEP_FIELDS[step - 1] ?? [];
    if (fieldsToValidate.length > 0) {
      const valid = await trigger(fieldsToValidate as never[]);
      if (!valid) return;
    }
    if (step === 2 && fields.length === 0) {
      setStepError("Kamida bitta ijtimoiy tarmoq hisobini qo'shing.");
      return;
    }
    if (step === 2 && contentNiches.length === 0) {
      setStepError("Kamida bitta kontent yo'nalishini tanlang.");
      return;
    }
    // Step 3's own card/bank fields are validated by react-hook-form's own registered rules (see
    // the "Karta raqami" TextField below) when the form is actually submitted — step 3 has no
    // "Keyingisi" button to reach this function at all (it goes straight to submit), so a
    // duplicate check here was unreachable dead code.
    try {
      await persist(Math.min(step + 1, STEP_TITLES.length));
      setStep((s) => Math.min(s + 1, STEP_TITLES.length));
    } catch {
      setStepError("Saqlashda xatolik yuz berdi. Qaytadan urinib ko'ring.");
    }
  }

  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function onFinalSubmit() {
    setStepError(null);
    if (!termsAccepted) {
      setStepError("Davom etish uchun shartlarni qabul qiling.");
      return;
    }
    try {
      await persist(STEP_TITLES.length);
      await finalizeApplication.mutateAsync();
    } catch {
      setStepError("Ariza yuborishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-3">
        <div className="flex w-full items-center justify-between">
          <CardTitle>{STEP_TITLES[step - 1]}</CardTitle>
          <span className="font-numeric text-sm tabular-nums text-text-muted">
            {step}/{STEP_TITLES.length}
          </span>
        </div>
        <ProgressBar value={step} max={STEP_TITLES.length} />
      </CardHeader>

      {revisionNote ? (
        <Alert tone="warning" className="mb-4">
          <strong>Admin izohi:</strong> {revisionNote}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit(onFinalSubmit)} className="flex flex-col gap-5" noValidate>
        {step === 1 ? (
          <>
            <TextField
              label="Telefon raqami"
              placeholder="+998 90 123 45 67"
              error={errors.phone?.message}
              {...register("phone", { required: "Telefon raqamini kiriting" })}
            />
            <TextField
              label="Shahar (ixtiyoriy)"
              placeholder="Toshkent"
              {...register("city")}
            />
            <TextAreaField label="Qisqacha o'zingiz haqingizda (ixtiyoriy)" {...register("bio")} />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="flex flex-col gap-4">
              <h3 className="font-heading text-sm font-medium text-text-primary">Ijtimoiy tarmoqlar</h3>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-3 rounded-input border border-border p-4 sm:grid-cols-2">
                  <SelectField label="Platforma" {...register(`socialAccounts.${index}.platform` as const)}>
                    {PLATFORM_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Foydalanuvchi nomi"
                    placeholder="@handle"
                    {...register(`socialAccounts.${index}.handle` as const)}
                  />
                  <TextField
                    label="Profil havolasi"
                    placeholder="https://instagram.com/..."
                    {...register(`socialAccounts.${index}.profileUrl` as const, {
                      pattern: {
                        value: /^https?:\/\/.+/,
                        message: "To'g'ri URL kiriting (https:// bilan boshlanishi kerak)"
                      }
                    })}
                  />
                  <TextField
                    label="Obunachilar soni"
                    type="number"
                    {...register(`socialAccounts.${index}.followerCount` as const, { valueAsNumber: true })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit text-error hover:bg-error/5 sm:col-span-2"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="mr-1.5 size-4" /> O&apos;chirish
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  append({ id: `sa_${Date.now()}`, platform: "INSTAGRAM", handle: "", profileUrl: "", followerCount: 0 })
                }
                className="w-fit"
              >
                <Plus className="mr-1.5 size-4" /> Ijtimoiy tarmoq qo&apos;shish
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-heading text-sm font-medium text-text-primary">Kontent yo'nalishlari</h3>
              <div className="flex flex-wrap gap-2">
                {NICHE_OPTIONS.map((niche) => {
                  const active = contentNiches.includes(niche);
                  return (
                    <button
                      key={niche}
                      type="button"
                      onClick={() =>
                        setValue(
                          "contentNiches",
                          active ? contentNiches.filter((n) => n !== niche) : [...contentNiches, niche],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 font-body text-sm transition-colors",
                        active ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:border-accent/50",
                      )}
                    >
                      {niche}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="font-heading text-sm font-medium text-text-primary">Auditoriya ma'lumotlari</h3>
              <TextField
                label="Auditoriya yosh oralig'i"
                placeholder="18–34"
                error={errors.audienceAgeRange?.message}
                {...register("audienceAgeRange", { required: "Auditoriya yoshini kiriting" })}
              />
              <TextField
                label="Auditoriya geografiyasi"
                placeholder="O'zbekiston, asosan Toshkent"
                error={errors.audienceGeography?.message}
                {...register("audienceGeography", { required: "Auditoriya geografiyasini kiriting" })}
              />
              <TextAreaField
                label="Auditoriya qiziqishlari"
                error={errors.audienceInterests?.message}
                {...register("audienceInterests", { required: "Auditoriya qiziqishlarini kiriting" })}
              />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <SelectField label="To'lov usuli" {...register("payoutMethodType")}>
              <option value="CARD">Bank kartasi</option>
              <option value="BANK_ACCOUNT">Bank hisob raqami</option>
            </SelectField>
            {payoutMethodType === "CARD" ? (
              <>
                <TextField
                  label="Karta raqami"
                  placeholder="8600 0000 0000 0000"
                  error={errors.payoutCardNumber?.message}
                  {...register("payoutCardNumber", {
                    required: "Karta raqamini kiriting",
                    // Accepts however the user actually types it (with or without the spaces the
                    // placeholder itself shows) — stripped before validating/storing, so a real
                    // card number typed exactly like the placeholder never fails the 16-digit check.
                    setValueAs: (v: string) => (v ?? "").replace(/\s+/g, ""),
                    pattern: {
                      value: /^\d{16}$/,
                      message: "16 xonali karta raqamini kiriting"
                    }
                  })}
                />
                <TextField
                  label="Karta egasi"
                  placeholder="MALIKA YUSUPOVA"
                  error={errors.payoutCardHolder?.message}
                  {...register("payoutCardHolder", {
                    required: "Karta egasini kiriting"
                  })}
                />
              </>
            ) : (
              <>
                <TextField label="Bank nomi" error={errors.payoutBankName?.message} {...register("payoutBankName", { required: "Bank nomini kiriting" })} />
                <TextField
                  label="Hisob raqami"
                  error={errors.payoutBankAccount?.message}
                  {...register("payoutBankAccount", { required: "Hisob raqamini kiriting" })}
                />
              </>
            )}

            <TextAreaField
              label="Oldingi hamkorlik tajribangiz (ixtiyoriy)"
              placeholder="Qaysi brendlar bilan ishlagansiz, qanday natijalarga erishgansiz..."
              {...register("priorExperience")}
            />

            <div className="flex flex-col gap-4">
              <div className="rounded-input border border-border bg-bg p-4 font-body text-sm text-text-secondary">
                <p className="mb-2 font-medium text-text-primary">Ariza xulosasi</p>
                <p>{applicantName} · {watch("city")}</p>
                <p>{fields.length} ta ijtimoiy tarmoq hisobi · {contentNiches.join(", ") || "—"}</p>
              </div>
              <label className="flex items-start gap-2 font-body text-sm text-text-secondary">
                <input type="checkbox" className="mt-1" {...register("termsAccepted")} />
                Men <a className="text-accent underline">hamkorlik shartlari</a>ni o&apos;qib chiqdim va qabul qilaman
              </label>
            </div>
          </>
        ) : null}

        {stepError ? <Alert tone="error">{stepError}</Alert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={goBack} disabled={step === 1}>
            Orqaga
          </Button>
          <div className="flex flex-wrap gap-2">
            {step < STEP_TITLES.length ? (
              <Button type="button" onClick={goNext} disabled={updateApplication.isPending}>
                Keyingisi
              </Button>
            ) : (
              <Button type="submit" disabled={finalizeApplication.isPending}>
                {finalizeApplication.isPending ? "Yuborilmoqda..." : "Arizani yuborish"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
