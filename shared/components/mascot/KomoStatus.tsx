import { Komo } from "@/shared/components/mascot/Komo";
import type { KomoAction } from "@/shared/lib/mascot/komo";

const STATUS_ACTIONS = {
  offline: "offline",
  syncing: "syncing",
  success: "success",
  failed: "failed",
  waiting: "idle",
} as const satisfies Record<string, KomoAction>;

export function KomoStatus({
  status,
  title,
  description,
  compact = false,
}: {
  status: keyof typeof STATUS_ACTIONS;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-surface-card p-3">
      <Komo action={STATUS_ACTIONS[status]} size={compact ? "xs" : "sm"} alt="" decorative />
      <div>
        <p className="text-sm font-semibold text-foreground-heading">{title}</p>
        {description ? <p className="mt-0.5 text-xs text-foreground-muted">{description}</p> : null}
      </div>
    </div>
  );
}

