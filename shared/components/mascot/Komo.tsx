import Image from "next/image";
import { cx } from "@/shared/lib/utils";
import { komoAssets, type KomoAction } from "@/shared/lib/mascot/komo";

export type KomoSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero";

const SIZE_CONFIG: Record<KomoSize, { pixels: number; className: string; sizes: string }> = {
  xs: { pixels: 40, className: "h-10 w-10", sizes: "40px" },
  sm: { pixels: 64, className: "h-16 w-16", sizes: "64px" },
  md: { pixels: 96, className: "h-24 w-24", sizes: "96px" },
  lg: { pixels: 140, className: "h-[140px] w-[140px]", sizes: "140px" },
  xl: { pixels: 200, className: "h-[200px] w-[200px]", sizes: "200px" },
  hero: { pixels: 280, className: "h-44 w-44 sm:h-56 sm:w-56 lg:h-[280px] lg:w-[280px]", sizes: "(max-width: 640px) 176px, (max-width: 1024px) 224px, 280px" },
};

export function Komo({
  action,
  size = "md",
  alt,
  className,
  priority = false,
  decorative = false,
}: {
  action: KomoAction;
  size?: KomoSize;
  alt?: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const config = SIZE_CONFIG[size];
  return (
    <span className={cx("relative inline-block shrink-0", config.className, `komo-${action}`, className)}>
      <Image
        src={komoAssets[action]}
        alt={decorative ? "" : alt ?? `Komo ${action.replace("-", " ")}`}
        width={config.pixels}
        height={config.pixels}
        sizes={config.sizes}
        priority={priority}
        aria-hidden={decorative || undefined}
        className="h-full w-full object-contain"
      />
    </span>
  );
}

