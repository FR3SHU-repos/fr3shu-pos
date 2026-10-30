import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/shared/lib/utils";

interface PaginationProps {
  page: number;
  /** Total pages. Omit for cursor-based lists and pass `hasNext` instead. */
  pages?: number;
  /** Overrides the page-count check for the Next button (cursor paging). */
  hasNext?: boolean;
  onPageChange: (page: number) => void;
  /** Disable both buttons, e.g. while a page is loading. */
  disabled?: boolean;
  /** Accessible name for the nav landmark. */
  label?: string;
  /** Extra text after "Page x of y", e.g. a total count. */
  detail?: string;
  /** Show chevron icons beside Previous / Next. */
  chevrons?: boolean;
  /** Draw a divider line above. */
  bordered?: boolean;
  className?: string;
}

const BTN =
  "inline-flex min-h-11 items-center gap-1 rounded-full bg-surface-muted px-5 text-sm font-semibold text-foreground-heading transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40";

/** Rounded Previous / Page x of y / Next control shared by every paged list. */
export function Pagination({
  page,
  pages,
  hasNext,
  onPageChange,
  disabled = false,
  label = "Pagination",
  detail,
  chevrons = false,
  bordered = false,
  className,
}: PaginationProps) {
  return (
    <nav
      aria-label={label}
      className={cx(
        "flex items-center justify-between gap-3 text-sm",
        bordered && "border-t border-border pt-4",
        className,
      )}
    >
      <button type="button" className={BTN} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        {chevrons ? <ChevronLeft className="h-4 w-4" aria-hidden /> : null}
        Previous
      </button>
      <span className="text-foreground-muted">
        Page {page}
        {pages !== undefined ? ` of ${pages}` : ""}
        {detail ? ` · ${detail}` : ""}
      </span>
      <button type="button" className={BTN} disabled={disabled || !(hasNext ?? page < (pages ?? 1))} onClick={() => onPageChange(page + 1)}>
        Next
        {chevrons ? <ChevronRight className="h-4 w-4" aria-hidden /> : null}
      </button>
    </nav>
  );
}
