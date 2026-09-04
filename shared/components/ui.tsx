import React from "react";
import { cx } from "@/shared/lib/utils";

export const inputCls =
  "w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm " +
  "text-foreground-heading placeholder:text-foreground-muted " +
  "focus:outline-none focus:ring-2 focus:ring-primary/30 transition";

export const cardCls = "rounded-2xl border border-border bg-surface-card p-5";

export const primaryBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 " +
  "text-sm font-semibold text-primary-foreground hover:bg-primary-hover transition " +
  "disabled:opacity-50 disabled:pointer-events-none min-h-11";

export const ghostBtnCls =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border " +
  "bg-surface-card px-4 py-2.5 text-sm font-medium text-foreground-body hover:bg-surface " +
  "transition disabled:opacity-50 min-h-11";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-status-success-surface text-status-success",
  closed: "bg-status-info-surface text-status-info",
  active: "bg-status-success-surface text-status-success",
  completed: "bg-status-success-surface text-status-success",
  Approved: "bg-status-success-surface text-status-success",
  Verified: "bg-status-success-surface text-status-success",
  pending: "bg-status-warning-surface text-status-warning",
  PendingVerification: "bg-status-warning-surface text-status-warning",
  InConversion: "bg-status-warning-surface text-status-warning",
  archived: "bg-tertiary/40 text-tertiary-foreground",
  inactive: "bg-tertiary/40 text-tertiary-foreground",
  Expired: "bg-status-danger-surface text-status-danger",
  Rejected: "bg-status-danger-surface text-status-danger",
  NotOrganic: "bg-status-danger-surface text-status-danger",
  voided: "bg-status-danger-surface text-status-danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_COLORS[status] ?? "bg-surface text-foreground-muted",
      )}
    >
      {status}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-tertiary/30", className)} />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-card px-6 py-14 text-center">
      {icon ? <div className="mb-3 text-foreground-muted">{icon}</div> : null}
      <p className="text-sm font-semibold text-foreground-heading">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-foreground-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PermissionDenied() {
  return (
    <EmptyState
      title="Permission denied"
      description="Your role does not allow access to this screen. Ask an Owner or Manager if you need it."
    />
  );
}
