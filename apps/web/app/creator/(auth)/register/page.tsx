"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardHeader, CardTitle, TextField, Alert } from "@rosti/ui";
import { useSession } from "@/services/session";
import { registerSchema, type RegisterInput } from "@/lib/schemas";
import { postAuthRoute } from "@/lib/routing";

export default function RegisterPage() {
  const router = useRouter();
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
      const created = await registerAccount(values.email, values.fullName, values.password);
      router.replace(postAuthRoute(created.application.status));
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
        <TextField
          label="Parolni tasdiqlang"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
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
