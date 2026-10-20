/** Browser print entry point used by receipts and the POS history view. */
export function printReceipt(): boolean {
  if (typeof window === "undefined" || typeof window.print !== "function") return false;
  window.print();
  return true;
}
