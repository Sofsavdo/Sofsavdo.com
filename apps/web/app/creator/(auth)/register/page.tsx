"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardHeader, CardTitle, TextField, Alert } from "@sofsavdo/ui";
import { useSession } from "@/services/session";
import { registerSchema, type RegisterInput } from "@/lib/schemas";
import { postAuthRoute } from "@/lib/routing";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Creator referral attribution (see DECISIONS.md ADR-013): the ?ref= param on this exact
  // route is the only entry point that can attribute a referral, and only at registration.
  const referralCode = searchParams.get("ref") ?? undefined;
  const { user, isLoading, register: registerAccount, registerPending, registerError } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (!isLoading && user) router.replace(postAuthRoute(user.application.status));
  }, [isLoading, user, router]);

  async function onSubmit(values: RegisterInput) {
    try {
      // Use promoCode from form if provided, otherwise use referralCode from URL
      const codeToUse = values.promoCode || referralCode;
      await registerAccount(values.email, values.fullName, values.password, codeToUse);
      // Wait for session to be updated, then redirect
      setTimeout(() => {
        router.replace("/creator/onboarding");
      }, 100);
    } catch {
      // surfaced via registerError below
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Creator sifatida qo&apos;shilish</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Hisob yarating va ariza topshirishni boshlang — bir necha daqiqa vaqt oladi
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="To'liq ism" autoComplete="name" error={errors.fullName?.message} {...register("fullName")} />
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
        <TextField
          label="Parol"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {registerError ? <Alert tone="error">{registerError}</Alert> : null}

        <Button type="submit" disabled={registerPending} className="mt-2">
          {registerPending ? "Yaratilmoqda..." : "Hisob yaratish"}
        </Button>
      </form>

      <p className="mt-6 text-center font-body text-sm text-text-secondary">
        Hisobingiz bormi?{" "}
        <Link href="/creator/login" className="text-accent underline">
          Kirish
        </Link>
      </p>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
