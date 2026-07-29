"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { Card, Skeleton, Button } from "@sofsavdo/ui";
import { formatMoneyMinor } from "@sofsavdo/types";
import { getSavedProducts, unsaveProduct } from "@/lib/api/buyer-real";

export default function BuyerSavedProductsPage() {
  const queryClient = useQueryClient();
  const savedQuery = useQuery({ queryKey: ["buyer-saved-products"], queryFn: getSavedProducts });

  const unsaveMutation = useMutation({
    mutationFn: (offerId: string) => unsaveProduct(offerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-saved-products"] }),
  });

  const saved = savedQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Saqlangan mahsulotlar</h1>

      {savedQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : saved.length === 0 ? (
        <Card>
          <p className="font-body text-sm text-text-muted">Hozircha saqlangan mahsulotlar yo&apos;q.</p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((s) => (
            <Card key={s.offerId} className="flex flex-col gap-3">
              <Link href={`/o/${s.offer.slug}`} className="font-body font-medium text-text-primary hover:text-accent">
                {s.offer.name}
              </Link>
              <span className="font-numeric text-lg font-bold tabular-nums text-accent">
                {formatMoneyMinor(s.offer.priceMinor, s.offer.currency)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={unsaveMutation.isPending}
                onClick={() => unsaveMutation.mutate(s.offerId)}
              >
                <Heart className="mr-1.5 size-4 fill-error text-error" /> Olib tashlash
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
