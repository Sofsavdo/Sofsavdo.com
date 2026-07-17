import { OnboardingPageClient } from "@/components/creator/OnboardingPageClient";

// Per-creator, session-dependent page — see the (app) layout's note on why this segment
// opts out of static prerendering.
export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  return <OnboardingPageClient />;
}
