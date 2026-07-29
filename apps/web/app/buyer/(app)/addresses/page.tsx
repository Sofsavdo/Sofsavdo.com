"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Star } from "lucide-react";
import { Alert, Button, Card, CardHeader, CardTitle, TextField, Badge } from "@sofsavdo/ui";
import { createAddress, deleteAddress, getMyAddresses, setDefaultAddress, type CreateBuyerAddressInput } from "@/lib/api/buyer-real";
import { ApiError } from "@/lib/api/http-client";

const addressSchema = z.object({
  label: z.string().optional(),
  region: z.string().min(2, "Viloyatni kiriting"),
  city: z.string().min(2, "Shaharni kiriting"),
  district: z.string().optional(),
  line1: z.string().min(3, "Manzilni kiriting"),
  comment: z.string().optional(),
});
type AddressInput = z.infer<typeof addressSchema>;

export default function BuyerAddressesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const addressesQuery = useQuery({ queryKey: ["buyer-addresses"], queryFn: getMyAddresses });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressInput>({ resolver: zodResolver(addressSchema) });

  const createMutation = useMutation({
    mutationFn: (input: CreateBuyerAddressInput) => createAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] });
      reset();
      setShowForm(false);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => setDefaultAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-addresses"] }),
  });

  const addresses = addressesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-text-primary">Manzillar</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Bekor qilish" : "Yangi manzil"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>Yangi manzil qo&apos;shish</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit((values) => createMutation.mutate(values))} className="flex flex-col gap-4" noValidate>
            <TextField label="Nomi (ixtiyoriy, masalan: Uy, Ish)" {...register("label")} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Viloyat" error={errors.region?.message} {...register("region")} />
              <TextField label="Shahar" error={errors.city?.message} {...register("city")} />
            </div>
            <TextField label="Tuman (ixtiyoriy)" {...register("district")} />
            <TextField label="Manzil" error={errors.line1?.message} {...register("line1")} />
            <TextField label="Izoh (ixtiyoriy)" {...register("comment")} />
            {createMutation.isError ? <Alert tone="error">{(createMutation.error as ApiError).message}</Alert> : null}
            <Button type="submit" disabled={createMutation.isPending} className="w-fit">
              {createMutation.isPending ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </form>
        </Card>
      ) : null}

      {addresses.length === 0 && !showForm ? (
        <Card>
          <p className="font-body text-sm text-text-muted">Hozircha manzillar yo&apos;q.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {addresses.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-body font-medium text-text-primary">{a.label || "Manzil"}</p>
                    {a.isDefault ? <Badge tone="accent">Standart</Badge> : null}
                  </div>
                  <p className="mt-1 font-body text-sm text-text-secondary">
                    {a.region}, {a.city}
                    {a.district ? `, ${a.district}` : ""}, {a.line1}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!a.isDefault ? (
                    <button
                      type="button"
                      onClick={() => setDefaultMutation.mutate(a.id)}
                      aria-label="Standart qilish"
                      className="rounded-input p-2 text-text-muted hover:bg-bg hover:text-accent"
                    >
                      <Star className="size-4" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(a.id)}
                    aria-label="O'chirish"
                    className="rounded-input p-2 text-text-muted hover:bg-bg hover:text-error"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
