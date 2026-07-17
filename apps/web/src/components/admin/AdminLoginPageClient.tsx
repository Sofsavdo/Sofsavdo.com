"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardHeader, CardTitle, TextField } from "@rosti/ui";
import { useAdminSession } from "@/services/adminSession";
import { loginSchema, type LoginInput } from "@/lib/schemas";

const DEMO_ACCOUNTS = [
  { email: "manager@rosti.uz", label: "Ozoda — Manager" },
  { email: "admin@rosti.uz", label: "Sherzod — Admin" },
  { email: "super@rosti.uz", label: "Kamron — Super Admin" },
];

export function AdminLoginPageClient() {
  const router = useRouter();
  const { user, isLoading, login, loginPending, loginError } = useAdminSession();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (!isLoading && user) router.replace("/admin/dashboard");
  }, [isLoading, user, router]);

  async function onSubmit(values: LoginInput) {
    try {
      await login(values.email, values.password);
      router.replace("/admin/dashboard");
    } catch {
      // surfaced via loginError below
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-pad-mobile py-12 md:px-pad-desktop">
      <p className="mb-8 font-heading text-2xl font-bold text-text-primary">Rosti Admin</p>
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Admin panelga kirish</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <TextField label="Email" type="email" error={errors.email?.message} {...register("email")} />
            <TextField label="Parol" type="password" error={errors.password?.message} {...register("password")} />
            {loginError ? <Alert tone="error">{loginError}</Alert> : null}
            <Button type="submit" disabled={loginPending} className="mt-2">
              {loginPending ? "Tekshirilmoqda..." : "Kirish"}
            </Button>
          </form>
          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4">
            <p className="font-body text-xs text-text-muted">Demo hisoblar (parol: istalgan 6+ belgi):</p>
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
        </Card>
      </div>
    </div>
  );
}
