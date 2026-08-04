"use client";

import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/api";

// The only survivor of the old Campaign-catalog service after the Flow simplification — every
// other export here (useCampaigns, useMyCampaigns, campaign applications, etc.) backed pages that
// have since been deleted (creator/campaigns, creator/my-campaigns, creator/promo-materials — see
// their replacements at creator/streams and creator/my-streams). This one still feeds the real,
// nav-linked product list on /creator/streams.
export function useAvailableProductsForPromotion(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["available-products"],
    queryFn: api.getAvailableProductsForPromotion,
    enabled: opts.enabled ?? true,
  });
}
