"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardHeader, CardTitle, TextField, Alert } from "@sofsavdo/ui";
import { useBuyerSession } from "@/services/buyerSession";
import { registerSchema, type RegisterInput } from "@/lib/schemas";

export default function BuyerRegisterPage() {
  const router = useRouter();
  const { user, isLoading, register: registerBuyer, registerPending, registerError } = useBuyerSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (!isLoading && user) router.replace("/buyer/dashboard");
  }, [isLoading, user, router]);

  async function onSubmit(values: RegisterInput) {
    try {
      await registerBuyer({ email: values.email, password: values.password, fullName: values.fullName });
      router.replace("/buyer/dashboard");
    } catch {
      // surfaced via registerError below
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Ro&apos;yxatdan o&apos;ting</CardTitle>
        <p className="font-body text-sm text-text-secondary">Buyurtmalaringizni kuzating va tezroq xarid qiling</p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="To'liq ism" error={errors.fullName?.message} {...register("fullName")} />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {registerError ? <Alert tone="error">{registerError}</Alert> : null}

        <Button type="submit" disabled={registerPending} className="mt-2">
          {registerPending ? "Yaratilmoqda..." : "Ro'yxatdan o'tish"}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-center font-body text-sm">
        <Link href="/buyer/login" className="text-accent underline">
          Hisobingiz bormi? Kirish
        </Link>
      </div>
    </Card>
  );
}
