import catalogJson from "./catalog.json";

/**
 * Komo avatar model shared with the mobile app and the Go API. The catalogue
 * (catalog.json) is the same file in all three; the API rejects any key that
 * is not in it and charges reward points for every item except the default Komo.
 */
export type AvatarPart = "pose" | "fur" | "bandana" | "suit" | "head" | "face" | "bg";
export type BuyerAvatar = Record<AvatarPart, string>;

export interface AvatarOption {
  key: string;
  name: string;
  /** Reward points to unlock. Absent for the free default Komo. */
  price?: number;
  sparkle?: boolean;
  cape?: boolean;
  swatch?: string;
  c1?: string;
  c2?: string;
}

interface Catalog {
  version: number;
  minPrice: number;
  defaults: BuyerAvatar;
  parts: Record<AvatarPart, AvatarOption[]>;
  presets: Record<string, Partial<BuyerAvatar>>;
  looks: Array<{ name: string; avatar: BuyerAvatar }>;
}

export const catalog = catalogJson as Catalog;
export const AVATAR_PARTS: AvatarPart[] = ["pose", "fur", "bandana", "suit", "head", "face", "bg"];
/** Every item except the default Komo costs at least this many reward points. */
export const MIN_PRICE = catalog.minPrice;
export const DEFAULT_AVATAR: BuyerAvatar = { ...catalog.defaults };

export function option(part: AvatarPart, key: string): AvatarOption | undefined {
  return catalog.parts[part].find((item) => item.key === key);
}

/** Returns a complete avatar; any missing or unknown part falls back to the default Komo. */
export function normaliseAvatar(raw: Partial<Record<AvatarPart, string>> | null | undefined) {
  const out = { ...DEFAULT_AVATAR };
  if (!raw) return out;
  for (const part of AVATAR_PARTS) {
    const key = raw[part];
    if (typeof key === "string" && option(part, key)) out[part] = key;
  }
  return out;
}

export type AvatarItem = { part: AvatarPart; key: string };
export type PricedItem = AvatarItem & { name: string; price: number };

const itemId = (part: AvatarPart, key: string) => `${part}:${key}`;

/** Points an item costs; the default Komo (and anything unknown) is free. */
export function priceOf(part: AvatarPart, key: string): number {
  return option(part, key)?.price ?? 0;
}

/** The set of "part:key" ids the buyer has bought. */
export function ownedSet(owned: AvatarItem[] | null | undefined): Set<string> {
  return new Set((owned ?? []).map((item) => itemId(item.part, item.key)));
}

/** Free items are always usable; everything else must have been bought. */
export function isOwned(part: AvatarPart, key: string, owned: Set<string>) {
  return priceOf(part, key) === 0 || owned.has(itemId(part, key));
}

/** The items in this look that still have to be bought, cheapest first. */
export function itemsToBuy(avatar: BuyerAvatar, owned: Set<string>): PricedItem[] {
  return AVATAR_PARTS.filter((part) => !isOwned(part, avatar[part], owned))
    .map((part) => ({
      part,
      key: avatar[part],
      name: option(part, avatar[part])?.name ?? avatar[part],
      price: priceOf(part, avatar[part]),
    }))
    .sort((a, b) => a.price - b.price);
}

/** Total points needed to wear this look. */
export function costOf(avatar: BuyerAvatar, owned: Set<string>) {
  return itemsToBuy(avatar, owned).reduce((sum, item) => sum + item.price, 0);
}

/** Picking a suit also puts on its matching hat or face item, but only one the buyer already owns. */
export function applyChoice(
  avatar: BuyerAvatar,
  part: AvatarPart,
  key: string,
  owned: Set<string>,
): BuyerAvatar {
  const next = { ...avatar, [part]: key };
  if (part === "suit") {
    const preset = catalog.presets[key] ?? {};
    for (const extra of ["head", "face"] as const) {
      const value = preset[extra];
      if (value && isOwned(extra, value, owned)) next[extra] = value;
    }
  }
  return next;
}

/** "Harvest, Straw hat +1" for the unlock bar. */
export function summariseItems(items: PricedItem[], max = 2) {
  const names = items.slice(0, max).map((item) => item.name);
  return items.length > max ? `${names.join(", ")} +${items.length - max}` : names.join(", ");
}

export type AvatarAction =
  | { kind: "saved" }
  | { kind: "save" }
  | { kind: "unlock"; cost: number; items: PricedItem[] }
  | { kind: "short"; cost: number; missing: number; items: PricedItem[] };

/** What the bottom bar offers for the look being tried on. */
export function avatarAction(
  draft: BuyerAvatar,
  saved: BuyerAvatar,
  owned: Set<string>,
  balance: number,
): AvatarAction {
  const items = itemsToBuy(draft, owned);
  const cost = items.reduce((sum, item) => sum + item.price, 0);
  if (items.length > 0) {
    return cost > balance
      ? { kind: "short", cost, missing: cost - balance, items }
      : { kind: "unlock", cost, items };
  }
  return sameAvatar(draft, saved) ? { kind: "saved" } : { kind: "save" };
}

export type AvatarCategory = "looks" | AvatarPart;
export const AVATAR_CATEGORIES: Array<{ id: AvatarCategory; label: string }> = [
  { id: "looks", label: "Looks" },
  { id: "suit", label: "Suits" },
  { id: "head", label: "Hats" },
  { id: "face", label: "Face" },
  { id: "fur", label: "Fur" },
  { id: "bandana", label: "Bandana" },
  { id: "bg", label: "Backdrop" },
  { id: "pose", label: "Pose" },
];

/** The part of Komo each picker tile should zoom to. */
export const PART_VIEW: Record<AvatarPart, "full" | "body" | "head" | "face"> = {
  suit: "body",
  head: "head",
  face: "face",
  pose: "body",
  fur: "body",
  bandana: "body",
  bg: "body",
};

export function sameAvatar(a: BuyerAvatar, b: BuyerAvatar) {
  return AVATAR_PARTS.every((part) => a[part] === b[part]);
}

export type AvatarLayer = { id: string; src: string };

const layer = (name: string): AvatarLayer => ({ id: name, src: `/avatar/${name}.png` });

/** Image layers, back to front, as 512x512 transparent PNGs in /public/avatar. */
export function avatarLayers(avatar: BuyerAvatar): AvatarLayer[] {
  const { pose, fur, bandana, suit, head, face } = avatar;
  const layers: AvatarLayer[] = [];
  if (option("suit", suit)?.cape) layers.push(layer(`cape-${pose}`));
  layers.push(layer(`base-${fur}-${pose}`));
  if (suit !== "none") layers.push(layer(`suit-${suit}-${pose}`));
  if (suit !== "none" || bandana !== "brand") layers.push(layer(`bandana-${bandana}-${pose}`));
  if (face !== "none") layers.push(layer(`face-${face}-${pose}`));
  if (head !== "none") layers.push(layer(`head-${head}-${pose}`));
  if (option("suit", suit)?.sparkle || option("head", head)?.sparkle)
    layers.push(layer("sparkles"));
  return layers;
}

/** Every image a given avatar needs, e.g. to warm the cache. */
export function avatarSources(avatar: BuyerAvatar) {
  return avatarLayers(avatar).map((item) => item.src);
}

/** Crop boxes on the 512 canvas: [x, y, size]. */
export const AVATAR_VIEWS = {
  full: [20, 8, 480],
  body: [60, 14, 400],
  head: [90, 6, 340],
  face: [110, 20, 300],
} as const;
export type AvatarView = keyof typeof AVATAR_VIEWS;
