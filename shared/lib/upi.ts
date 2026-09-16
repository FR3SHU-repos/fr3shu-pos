export function isValidUpiId(value: string): boolean {
  return /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(value.trim());
}

export function buildUpiPaymentUri(input: {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  note?: string;
}): string {
  if (!isValidUpiId(input.upiId)) throw new Error("A valid UPI ID is required.");
  if (!Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new Error("A positive payment amount is required.");
  }
  const params = new URLSearchParams({
    pa: input.upiId.trim(),
    pn: input.payeeName.trim() || input.upiId.trim(),
    am: (input.amountPaise / 100).toFixed(2),
    cu: "INR",
  });
  if (input.note?.trim()) params.set("tn", input.note.trim());
  return `upi://pay?${params.toString()}`;
}
