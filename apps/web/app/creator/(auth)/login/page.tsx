"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardHeader, CardTitle, TextField, Alert } from "@rosti/ui";
import { useSession } from "@/services/session";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { postAuthRoute } from "@/lib/routing";

const DEMO_ACCOUNTS = [
  { email: "malika@example.uz", label: "Malika — tasdiqlangan creator" },
  { email: "aziz@example.uz", label: "Aziz — ko'rib chiqilmoqda" },
  { email: "dilnoza@example.uz", label: "Dilnoza — tuzatish talab qilingan" },
  { email: "sardor@example.uz", label: "Sardor — rad etilgan" },
];

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, login, loginPending, loginError } = useSession();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && user) router.replace(postAuthRoute(user.application.status));
  }, [isLoading, user, router]);

  async function onSubmit(values: LoginInput) {
    try {
      const loggedIn = await login(values.email, values.password);
      router.replace(postAuthRoute(loggedIn.application.status));
    } catch {
      // surfaced via loginError below
    }
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Creator sifatida kirish</CardTitle>
        <p className="font-body text-sm text-text-secondary">Hisobingizga kiring va kampaniyalaringizni boshqaring</p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />
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

      <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
        <p className="font-body text-xs text-text-muted">
          Demo hisoblar (parol: istalgan 6+ belgi, masalan <code>demo1234</code>):
        </p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => setValue("email", acc.email)}
              className="rounded-full border border-border px-3 py-1 font-body text-xs text-text-secondary hover:border-accent hover:text-accent"
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between font-body text-sm">
        <Link href="/creator/forgot-password" className="text-text-secondary underline">
          Parolni unutdingizmi?
        </Link>
        <Link href="/creator/register" className="text-accent underline">
          Ro&apos;yxatdan o&apos;tish
        </Link>
      </div>
    </Card>
  );
}
