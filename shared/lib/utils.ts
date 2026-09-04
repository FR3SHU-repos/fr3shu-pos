/** Conditional className combiner — used everywhere instead of a third-party lib. */
export const cx = (...args: Array<string | false | null | undefined>): string =>
  args.filter(Boolean).join(" ");
