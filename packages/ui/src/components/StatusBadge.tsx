import { CheckCircle2, XCircle, AlertTriangle, Info, Circle } from "lucide-react";
import { Badge } from "./Badge";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

const TONE_ICON: Record<Tone, typeof Circle> = {
  neutral: Circle,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  accent: Info,
};

// Status must never be color-only (a11y + admin operators scanning dense tables) — every status
// pill in the admin surface pairs an icon with the label text, not just a tint.
export function StatusBadge({ tone, label }: { tone: Tone; label: string }) {
  const Icon = TONE_ICON[tone];
  return (
    <Badge tone={tone} className="gap-1">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}
