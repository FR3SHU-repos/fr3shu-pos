"use client";

import { PlayCircle } from "lucide-react";
import { cardCls } from "@/shared/components/ui";
import type { HeldCart } from "@/shared/components/pos/types";
import type { PosTranslator } from "@/shared/components/pos/translator";

interface HeldCartsListProps {
  held: HeldCart[];
  onResume: (entry: HeldCart) => void;
  t: PosTranslator;
}

export function HeldCartsList({ held, onResume, t }: HeldCartsListProps) {
  if (held.length === 0) return null;
  return (
    <div className={cardCls}>
      <p className="mb-2 text-xs font-semibold text-foreground-heading">{t("pos.resume")}</p>
      <ul className="space-y-1">
        {held.map((h) => (
          <li key={h.id} className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">{h.label}</span>
            <button className="flex items-center gap-1 text-brand" onClick={() => onResume(h)}>
              <PlayCircle className="h-4 w-4" />
              {t("pos.resume")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
