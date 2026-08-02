"use client";

import { LaunchBonusProgress } from "@/components/creator/LaunchBonusProgress";

export default function LaunchBonusPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Launch Bonus</h1>
        <p className="font-body text-sm text-text-secondary">
          Yangi creatorlar uchun bonus tizimi
        </p>
      </div>
      <LaunchBonusProgress />
    </div>
  );
}
