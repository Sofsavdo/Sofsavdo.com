"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardHeader, CardTitle, TextField, Alert } from "@sofsavdo/ui";
import { useBuyerSession } from "@/services/buyerSession";
import { loginSchema, type LoginInput } from "@/lib/schemas";

export default function BuyerLoginPage() {
  const router = useRouter();
  const { user, isLoading, login, loginPending, loginError } = useBuyerSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && user) router.replace("/buyer/dashboard");
  }, [isLoading, user, router]);

  async function onSubmit(values: LoginInput) {
    try {
      await login(values.email, values.password);
      router.replace("/buyer/dashboard");
    } catch {
      // surfaced via loginError below
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Hisobingizga kiring</CardTitle>
        <p className="font-body text-sm text-text-secondary">Buyurtmalaringiz va saqlangan mahsulotlaringizni ko&apos;ring</p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          error={errors.email?.message}
          {...register("email")}
        />
        <TextField
          label="Parol"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {loginError ? <Alert tone="error">{loginError}</Alert> : null}

        <Button type="submit" disabled={loginPending} className="mt-2">
          {loginPending ? "Tekshirilmoqda..." : "Kirish"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-center font-body text-sm">
        <Link href="/buyer/register" className="text-accent underline">
          Hisobingiz yo&apos;qmi? Ro&apos;yxatdan o&apos;ting
        </Link>
      </div>
    </Card>
  );
}
