import { CreatorAppGuard } from "@/components/creator/CreatorAppGuard";

// This whole segment is per-creator, session-backed state — there is nothing here a
// static prerender pass could usefully cache, and every page is empty until the client mounts
// and reads the session anyway.
export const dynamic = "force-dynamic";

export default function CreatorAppLayout({ children }: { children: React.ReactNode }) {
  return <CreatorAppGuard>{children}</CreatorAppGuard>;
}
