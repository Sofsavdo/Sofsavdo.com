"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, CardHeader, CardTitle, TextField, Alert } from "@sofsavdo/ui";
import * as api from "@/lib/api";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas";

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const mutation = useMutation({
    mutationFn: (email: string) => api.forgotPassword(email),
  });

  async function onSubmit(values: ForgotPasswordInput) {
    try {
      await mutation.mutateAsync(values.email);
      setSentTo(values.email);
    } catch {
      // surfaced via mutation.error below
    }
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Havola yuborildi</CardTitle>
        </CardHeader>
        <Alert tone="success">
          Parolni tiklash havolasi <strong>{sentTo}</strong> manziliga yuborildi. Pochta qutingizni tekshiring.
        </Alert>
        <Link href="/creator/login" className="mt-6 block text-center font-body text-sm text-accent underline">
          Kirish sahifasiga qaytish
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle>Parolni unutdingizmi?</CardTitle>
        <p className="font-body text-sm text-text-secondary">
          Ro&apos;yxatdan o&apos;tgan emailingizni kiriting, tiklash havolasini yuboramiz
        </p>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register("email")} />

        {mutation.error ? <Alert tone="error">{(mutation.error as api.ApiError).message}</Alert> : null}

        <Button type="submit" disabled={mutation.isPending} className="mt-2">
          {mutation.isPending ? "Yuborilmoqda..." : "Tiklash havolasini yuborish"}
        </Button>
      </form>

      <Link href="/creator/login" className="mt-6 block text-center font-body text-sm text-text-secondary underline">
        Kirish sahifasiga qaytish
      </Link>
    </Card>
  );
}
