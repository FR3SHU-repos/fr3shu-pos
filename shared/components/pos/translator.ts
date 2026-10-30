import type { translator } from "@/shared/lib/i18n";

/** Translate function handed down to the POS components. */
export type PosTranslator = ReturnType<typeof translator>;
