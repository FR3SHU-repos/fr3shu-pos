import Link from "next/link";
import { Komo } from "@/shared/components/mascot/Komo";
import type { KomoAction } from "@/shared/lib/mascot/komo";
import { primaryBtnCls } from "@/shared/components/ui";

export function KomoEmptyState({
  action,
  title,
  description,
  buttonLabel,
  buttonHref,
}: {
  action: KomoAction;
  title: string;
  description: string;
  buttonLabel?: string;
  buttonHref?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-card px-6 py-10 text-center">
      <Komo action={action} size="lg" alt="" decorative />
      <p className="mt-3 text-sm font-semibold text-foreground-heading">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-foreground-muted">{description}</p>
      {buttonLabel && buttonHref ? <Link href={buttonHref} className={`${primaryBtnCls} mt-4`}>{buttonLabel}</Link> : null}
    </div>
  );
}

