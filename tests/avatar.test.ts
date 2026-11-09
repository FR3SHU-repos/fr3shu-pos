import { describe, expect, it } from "vitest";
import {
  DEFAULT_AVATAR,
  MIN_PRICE,
  applyChoice,
  avatarAction,
  avatarLayers,
  catalog,
  costOf,
  isOwned,
  itemsToBuy,
  normaliseAvatar,
  ownedSet,
  priceOf,
  summariseItems,
} from "@/shared/lib/avatar/avatar";

const none = ownedSet([]);

describe("Komo avatar model", () => {
  it("only the default Komo is free; every other item costs at least 10 points", () => {
    expect(MIN_PRICE).toBe(10);
    for (const [part, options] of Object.entries(catalog.parts)) {
      for (const item of options) {
        const free = catalog.defaults[part as keyof typeof catalog.defaults] === item.key;
        if (free) expect(item.price ?? 0, `${part}:${item.key}`).toBe(0);
        else expect(item.price ?? 0, `${part}:${item.key}`).toBeGreaterThanOrEqual(10);
      }
    }
    expect(priceOf("suit", "farmer")).toBe(10);
    expect(priceOf("suit", "hero")).toBe(30);
    expect(priceOf("suit", "none")).toBe(0);
  });

  it("falls back to the default Komo for missing or unknown parts", () => {
    expect(normaliseAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(normaliseAvatar({ suit: "wizard", fur: "golden" })).toEqual({
      ...DEFAULT_AVATAR,
      fur: "golden",
    });
  });

  it("every catalogue look and preset uses real catalogue keys", () => {
    const has = (part: keyof typeof catalog.parts, key: string) =>
      catalog.parts[part].some((item) => item.key === key);
    for (const look of catalog.looks)
      for (const [part, key] of Object.entries(look.avatar))
        expect(has(part as keyof typeof catalog.parts, key), `${look.name}.${part}`).toBe(true);
    for (const [suit, preset] of Object.entries(catalog.presets)) {
      expect(has("suit", suit)).toBe(true);
      for (const [part, key] of Object.entries(preset))
        expect(has(part as keyof typeof catalog.parts, key as string)).toBe(true);
    }
  });

  it("tracks ownership: free items always, priced items only once bought", () => {
    expect(isOwned("fur", "classic", none)).toBe(true);
    expect(isOwned("suit", "farmer", none)).toBe(false);
    expect(isOwned("suit", "farmer", ownedSet([{ part: "suit", key: "farmer" }]))).toBe(true);
  });

  it("lists and totals what a look still needs", () => {
    const look = { ...DEFAULT_AVATAR, suit: "hero", face: "mask", bg: "night" };
    expect(itemsToBuy(look, none).map((item) => item.key)).toEqual(["night", "hero", "mask"]);
    expect(costOf(look, none)).toBe(20 + 30 + 30);
    const have = ownedSet([{ part: "suit", key: "hero" }]);
    expect(costOf(look, have)).toBe(50);
    expect(costOf(DEFAULT_AVATAR, none)).toBe(0);
  });

  it("a suit also puts on its matching hat only when that hat is owned", () => {
    expect(applyChoice(DEFAULT_AVATAR, "suit", "farmer", none).head).toBe("none");
    const straw = ownedSet([{ part: "head", key: "straw" }]);
    expect(applyChoice(DEFAULT_AVATAR, "suit", "farmer", straw).head).toBe("straw");
  });

  it("the bottom bar offers save, unlock or a shortfall", () => {
    const hat = { ...DEFAULT_AVATAR, head: "straw" };
    expect(avatarAction(DEFAULT_AVATAR, DEFAULT_AVATAR, none, 0).kind).toBe("saved");
    const owned = ownedSet([{ part: "head", key: "straw" }]);
    expect(avatarAction(hat, DEFAULT_AVATAR, owned, 0).kind).toBe("save");
    expect(avatarAction(hat, DEFAULT_AVATAR, none, 10)).toMatchObject({ kind: "unlock", cost: 10 });
    expect(avatarAction(hat, DEFAULT_AVATAR, none, 4)).toMatchObject({
      kind: "short",
      cost: 10,
      missing: 6,
    });
  });

  it("summarises item names for the unlock bar", () => {
    const items = itemsToBuy(
      { ...DEFAULT_AVATAR, suit: "farmer", head: "straw", bg: "leaf" },
      none,
    );
    expect(summariseItems(items)).toBe("Harvest, Straw hat +1");
    expect(summariseItems(items, 3)).toBe("Harvest, Straw hat, Leaf");
  });

  it("stacks layers back to front and skips the bandana overlay for the plain Komo", () => {
    expect(avatarLayers(DEFAULT_AVATAR).map((layer) => layer.id)).toEqual(["base-classic-arms"]);
    const ids = avatarLayers({
      ...DEFAULT_AVATAR,
      suit: "hero",
      head: "crown",
      face: "mask",
      pose: "wave",
    }).map((layer) => layer.id);
    expect(ids).toEqual([
      "cape-wave",
      "base-classic-wave",
      "suit-hero-wave",
      "bandana-brand-wave",
      "face-mask-wave",
      "head-crown-wave",
      "sparkles",
    ]);
  });
});
