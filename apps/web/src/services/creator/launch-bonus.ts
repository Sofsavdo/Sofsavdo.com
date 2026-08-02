"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyLaunchBonus } from "@/lib/api/creator-real";

export function useMyLaunchBonus() {
  return useQuery({
    queryKey: ["my-launch-bonus"],
    queryFn: getMyLaunchBonus,
  });
}
