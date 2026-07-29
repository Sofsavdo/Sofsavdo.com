"use client";

import { Card, CardHeader, CardTitle } from "@sofsavdo/ui";
import { useBuyerSession } from "@/services/buyerSession";

// Read-only, same as the creator profile page's own precedent (Phase A2) — no
// PATCH /auth/me endpoint exists yet to edit these fields, so this page doesn't pretend to.
export default function BuyerProfilePage() {
  const { user } = useBuyerSession();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-2xl font-bold text-text-primary">Profil</h1>
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>Shaxsiy ma&apos;lumotlar</CardTitle>
        </CardHeader>
        <dl className="flex flex-col gap-3 font-body text-sm">
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-text-secondary">To&apos;liq ism</dt>
            <dd className="text-text-primary">{user?.displayName ?? "—"}</dd>
          </div>
          <div className="flex justify-between border-b border-border pb-2">
            <dt className="text-text-secondary">Email</dt>
            <dd className="text-text-primary">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Telefon</dt>
            <dd className="text-text-primary">{user?.phone ?? "—"}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
