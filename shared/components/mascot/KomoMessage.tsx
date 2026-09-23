import Link from "next/link";
import { Komo, type KomoSize } from "@/shared/components/mascot/Komo";
import type { KomoAction } from "@/shared/lib/mascot/komo";
import { cx } from "@/shared/lib/utils";

export function KomoMessage({
  action,
  title,
  description,
  cta,
  compact = false,
  align = "left",
}: {
  action: KomoAction;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  compact?: boolean;
  align?: "left" | "right";
}) {
  const size: KomoSize = compact ? "sm" : "md";
  return (
    <section className={cx("flex items-center gap-4 rounded-2xl border border-border bg-surface-card p-4", align === "right" && "flex-row-reverse text-right")}>
      <Komo action={action} size={size} alt="" decorative />
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-foreground-heading">{title}</h2>
        {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
        {cta ? <Link href={cta.href} className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline">{cta.label}</Link> : null}
      </div>
    </section>
  );
}

