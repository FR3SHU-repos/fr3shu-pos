export type Period = "today" | "yesterday" | "week" | "all";

export const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "7 days" },
  { key: "all", label: "All" },
];

/** Local-midnight bounds as RFC3339 instants; `to` is exclusive. */
export function periodBounds(
  period: Period,
  now: Date = new Date(),
): { from?: string; to?: string } {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (offset: number) =>
    new Date(
      midnight.getFullYear(),
      midnight.getMonth(),
      midnight.getDate() + offset,
    ).toISOString();
  if (period === "today") return { from: day(0), to: day(1) };
  if (period === "yesterday") return { from: day(-1), to: day(0) };
  if (period === "week") return { from: day(-6), to: day(1) };
  return {};
}

/** True when the instant falls inside the (optional) [from, to) bounds. */
export function inBounds(
  at: string | number | Date,
  bounds: { from?: string; to?: string },
): boolean {
  const t = new Date(at).getTime();
  return (
    (!bounds.from || t >= new Date(bounds.from).getTime()) &&
    (!bounds.to || t < new Date(bounds.to).getTime())
  );
}

/** Last 10 digits of a typed phone number, for matching against stored numbers. */
export function normalizePhoneSearch(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export interface SalesSummary {
  completedCount: number;
  totalPaise: number;
}

/** Server summary plus unsynced offline cash sales, which the server has not counted yet. */
export function combineSummary(
  server: SalesSummary | null,
  pendingOffline: { count: number; totalPaise: number },
): SalesSummary & { hasData: boolean } {
  return {
    completedCount: (server?.completedCount ?? 0) + pendingOffline.count,
    totalPaise: (server?.totalPaise ?? 0) + pendingOffline.totalPaise,
    hasData: Boolean(server) || pendingOffline.count > 0,
  };
}
