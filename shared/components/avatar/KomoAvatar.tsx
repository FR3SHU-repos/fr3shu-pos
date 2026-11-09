import Image from "next/image";
import type { CSSProperties } from "react";
import { cx } from "@/shared/lib/utils";
import {
  AVATAR_VIEWS,
  DEFAULT_AVATAR,
  avatarLayers,
  option,
  type AvatarView,
  type BuyerAvatar,
} from "@/shared/lib/avatar/avatar";

/**
 * A buyer's Komo, drawn from stacked transparent PNG layers. Pass `view` to
 * crop to the head or face (profile pictures, list rows). The backdrop is
 * optional so the picker can show items on a plain tile.
 */
export function KomoAvatar({
  avatar,
  view = "full",
  backdrop = true,
  className,
  label = "Your Komo avatar",
  priority = false,
}: {
  avatar?: BuyerAvatar | null;
  view?: AvatarView;
  backdrop?: boolean;
  className?: string;
  label?: string;
  priority?: boolean;
}) {
  const value = avatar ?? DEFAULT_AVATAR;
  const [x, y, size] = AVATAR_VIEWS[view];
  const bg = option("bg", value.bg);
  const style: CSSProperties | undefined =
    backdrop && bg?.c1 && bg.c2
      ? { background: `radial-gradient(circle at 50% 40%, ${bg.c1}, ${bg.c2})` }
      : undefined;
  return (
    <span
      role="img"
      aria-label={label}
      className={cx("relative block aspect-square overflow-hidden", className)}
      style={style}
    >
      <span
        aria-hidden="true"
        className="absolute block"
        style={{
          width: `${(512 / size) * 100}%`,
          height: `${(512 / size) * 100}%`,
          left: `${(-x / size) * 100}%`,
          top: `${(-y / size) * 100}%`,
        }}
      >
        {avatarLayers(value).map((item) => (
          <Image
            key={item.id}
            src={item.src}
            alt=""
            width={512}
            height={512}
            unoptimized
            priority={priority}
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full select-none"
          />
        ))}
      </span>
    </span>
  );
}
