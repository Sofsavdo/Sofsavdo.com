import { BuyerAppGuard } from "@/components/buyer/BuyerAppGuard";

export const dynamic = "force-dynamic";

export default function BuyerAppLayout({ children }: { children: React.ReactNode }) {
  return <BuyerAppGuard>{children}</BuyerAppGuard>;
}
