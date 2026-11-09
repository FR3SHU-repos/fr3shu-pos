"use client";

import { useMemo, useState } from "react";
import { Check, Coins, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { KomoAvatar } from "@/shared/components/avatar/KomoAvatar";
import {
  AVATAR_CATEGORIES,
  PART_VIEW,
  applyChoice,
  avatarAction,
  catalog,
  costOf,
  isOwned,
  itemsToBuy,
  option,
  ownedSet,
  priceOf,
  summariseItems,
  type AvatarCategory,
  type AvatarItem,
  type AvatarOption,
  type AvatarPart,
  type BuyerAvatar,
} from "@/shared/lib/avatar/avatar";
import { cx } from "@/shared/lib/utils";

export interface AvatarStudioState {
  avatar: BuyerAvatar;
  owned: AvatarItem[];
  availableCoins: number;
}

type Outcome = { ok: boolean; message?: string; state?: AvatarStudioState };

/**
 * The Komo avatar editor. Tap anything to try it on; items cost reward points
 * (shown on every tile) and stay owned once bought. The bottom bar adds up what
 * the look needs and buys + saves it in one step.
 */
export function AvatarStudio({
  initial,
  onSave,
  onUnlock,
}: {
  initial: AvatarStudioState;
  onSave: (avatar: BuyerAvatar) => Promise<Outcome>;
  onUnlock: (items: AvatarItem[], avatar: BuyerAvatar) => Promise<Outcome>;
}) {
  const [saved, setSaved] = useState<BuyerAvatar>(initial.avatar);
  const [draft, setDraft] = useState<BuyerAvatar>(initial.avatar);
  const [ownedList, setOwnedList] = useState<AvatarItem[]>(initial.owned);
  const [balance, setBalance] = useState(initial.availableCoins);
  const [category, setCategory] = useState<AvatarCategory>("suit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const owned = useMemo(() => ownedSet(ownedList), [ownedList]);
  const action = avatarAction(draft, saved, owned, balance);

  function pick(part: AvatarPart, item: AvatarOption) {
    setError("");
    setDraft((current) => applyChoice(current, part, item.key, owned));
  }

  async function commit() {
    if (busy || action.kind === "saved" || action.kind === "short") return;
    setBusy(true);
    setError("");
    const result =
      action.kind === "unlock"
        ? await onUnlock(
            action.items.map(({ part, key }) => ({ part, key })),
            draft,
          )
        : await onSave(draft);
    setBusy(false);
    if (!result.ok || !result.state) {
      setError(result.message || "Could not save your avatar. Try again in a moment.");
      toast.error(result.message || "Could not save your avatar");
      return;
    }
    setOwnedList(result.state.owned);
    setBalance(result.state.availableCoins);
    setSaved(draft);
    toast.success(
      action.kind === "unlock"
        ? `Unlocked ${action.items.length} ${action.items.length === 1 ? "item" : "items"} and saved`
        : "Avatar saved",
    );
  }

  const suitName = option("suit", draft.suit)?.name;
  const title = draft.suit === "none" ? "Your Komo" : `Komo in ${suitName}`;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <section aria-label="Avatar preview" className="lg:sticky lg:top-4">
        <div className="overflow-hidden rounded-3xl bg-surface-card">
          <div className="flex items-center justify-between gap-3 p-4 pb-2">
            <h2 className="min-w-0 truncate text-lg font-bold text-foreground-heading">{title}</h2>
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-sm font-semibold text-foreground-heading"
              aria-label={`${balance} reward points to spend`}
            >
              <Coins className="h-4 w-4 text-primary" aria-hidden="true" />
              {balance}
              <span className="font-medium text-foreground-muted">pts</span>
            </span>
          </div>
          <div className="px-4 pb-4">
            <KomoAvatar
              avatar={draft}
              view="full"
              priority
              className="mx-auto w-full max-w-[18rem] rounded-2xl sm:max-w-sm"
            />
          </div>
        </div>
        <ActionBar action={action} busy={busy} error={error} onCommit={() => void commit()} />
      </section>

      <section
        aria-label="Avatar items"
        className="min-w-0 overflow-hidden rounded-3xl bg-surface-card"
      >
        <div
          role="tablist"
          aria-label="Avatar categories"
          className="flex gap-2 overflow-x-auto border-b border-border p-3"
        >
          {AVATAR_CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={category === item.id}
              onClick={() => setCategory(item.id)}
              className={cx(
                "min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition",
                category === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-muted text-foreground-heading hover:bg-tertiary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {category === "looks" ? (
            <LookGrid owned={owned} onPick={(look) => setDraft(look)} />
          ) : category === "fur" || category === "bandana" || category === "bg" ? (
            <SwatchGrid part={category} draft={draft} owned={owned} onPick={pick} />
          ) : (
            <ItemGrid part={category} draft={draft} owned={owned} onPick={pick} />
          )}
        </div>
      </section>
    </div>
  );
}

function ActionBar({
  action,
  busy,
  error,
  onCommit,
}: {
  action: ReturnType<typeof avatarAction>;
  busy: boolean;
  error: string;
  onCommit: () => void;
}) {
  const disabled = busy || action.kind === "saved" || action.kind === "short";
  const buying = action.kind === "unlock" || action.kind === "short";
  return (
    <div
      className={cx(
        "fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        "lg:static lg:z-auto lg:mt-3 lg:rounded-3xl lg:border-0 lg:p-4",
      )}
    >
      {error ? (
        <p role="alert" className="mb-2 text-center text-sm text-status-warning">
          {error}
        </p>
      ) : null}
      {buying ? (
        <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-sm text-foreground-muted">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="truncate">New: {summariseItems(action.items)}</span>
        </p>
      ) : null}
      <button
        type="button"
        onClick={onCommit}
        disabled={disabled}
        className={cx(
          "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition",
          action.kind === "short"
            ? "bg-surface-muted text-foreground-muted"
            : "bg-primary text-primary-foreground hover:bg-primary-hover",
          "disabled:cursor-not-allowed",
          action.kind === "saved" && "bg-surface-muted text-foreground-muted",
        )}
      >
        {busy ? (
          "Saving…"
        ) : action.kind === "saved" ? (
          <>
            <Check className="h-5 w-5" aria-hidden="true" /> Saved
          </>
        ) : action.kind === "save" ? (
          "Save"
        ) : action.kind === "unlock" ? (
          <>
            Unlock &amp; save
            <span className="inline-flex items-center gap-1 rounded-full bg-black/15 px-2.5 py-0.5 text-sm">
              <Coins className="h-4 w-4" aria-hidden="true" />
              {action.cost}
            </span>
          </>
        ) : (
          `Need ${action.missing} more points`
        )}
      </button>
      {action.kind === "short" ? (
        <p className="mt-2 text-center text-xs text-foreground-muted">
          Shop with Komola to earn points, or remove an item to save a cheaper look.
        </p>
      ) : null}
    </div>
  );
}

function PriceTag({
  price,
  owned,
  selected,
}: {
  price: number;
  owned: boolean;
  selected: boolean;
}) {
  if (selected && owned) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        Wearing
      </span>
    );
  }
  if (price === 0) return <span className="text-xs font-medium text-foreground-muted">Free</span>;
  if (owned) return <span className="text-xs font-semibold text-status-success">Owned</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-card px-2 py-0.5 text-xs font-bold text-foreground-heading">
      <Coins className="h-3 w-3 text-primary" aria-hidden="true" />
      {price}
    </span>
  );
}

function ItemGrid({
  part,
  draft,
  owned,
  onPick,
}: {
  part: AvatarPart;
  draft: BuyerAvatar;
  owned: Set<string>;
  onPick: (part: AvatarPart, item: AvatarOption) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {catalog.parts[part].map((item) => {
        const selected = draft[part] === item.key;
        const have = isOwned(part, item.key, owned);
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            aria-label={`${item.name}, ${priceOf(part, item.key) === 0 ? "free" : have ? "owned" : `${item.price} points`}`}
            onClick={() => onPick(part, item)}
            className={cx(
              "flex flex-col items-center gap-1 overflow-hidden rounded-2xl border-2 bg-surface-muted pb-2 text-center transition",
              selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-tertiary",
            )}
          >
            <KomoAvatar
              avatar={{ ...draft, [part]: item.key }}
              view={PART_VIEW[part]}
              backdrop={false}
              label={item.name}
            />
            <span className="max-w-full truncate px-2 text-sm font-semibold text-foreground-heading">
              {item.name}
            </span>
            <PriceTag price={priceOf(part, item.key)} owned={have} selected={selected} />
          </button>
        );
      })}
    </div>
  );
}

function SwatchGrid({
  part,
  draft,
  owned,
  onPick,
}: {
  part: AvatarPart;
  draft: BuyerAvatar;
  owned: Set<string>;
  onPick: (part: AvatarPart, item: AvatarOption) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {catalog.parts[part].map((item) => {
        const selected = draft[part] === item.key;
        const have = isOwned(part, item.key, owned);
        const color = item.swatch ?? item.c1 ?? "#999";
        return (
          <button
            key={item.key}
            type="button"
            aria-pressed={selected}
            aria-label={`${item.name}, ${priceOf(part, item.key) === 0 ? "free" : have ? "owned" : `${item.price} points`}`}
            onClick={() => onPick(part, item)}
            className={cx(
              "flex flex-col items-center gap-2 rounded-2xl border-2 bg-surface-muted px-2 py-3 transition",
              selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-tertiary",
            )}
          >
            <span
              className="grid h-14 w-14 place-items-center rounded-2xl shadow-inner"
              style={{ background: color }}
            >
              {selected ? (
                <Check className="h-6 w-6 text-white drop-shadow" aria-hidden="true" />
              ) : null}
            </span>
            <span className="max-w-full truncate text-sm font-semibold text-foreground-heading">
              {item.name}
            </span>
            <PriceTag price={priceOf(part, item.key)} owned={have} selected={selected} />
          </button>
        );
      })}
    </div>
  );
}

function LookGrid({
  owned,
  onPick,
}: {
  owned: Set<string>;
  onPick: (avatar: BuyerAvatar) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {catalog.looks.map((look) => {
        const cost = costOf(look.avatar, owned);
        const count = itemsToBuy(look.avatar, owned).length;
        return (
          <button
            key={look.name}
            type="button"
            onClick={() => onPick(look.avatar)}
            className="overflow-hidden rounded-2xl bg-surface-muted text-left transition hover:bg-tertiary"
          >
            <KomoAvatar avatar={look.avatar} view="body" label={look.name} />
            <span className="block px-3 pt-2 text-sm font-semibold text-foreground-heading">
              {look.name}
            </span>
            <span className="block px-3 pb-3 pt-0.5 text-xs text-foreground-muted">
              {cost === 0 ? (
                "You own everything in this look"
              ) : (
                <>
                  {count} {count === 1 ? "item" : "items"} to unlock · {cost} pts
                </>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
