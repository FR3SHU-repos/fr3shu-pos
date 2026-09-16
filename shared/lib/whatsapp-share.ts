import type { SaleDTO } from "@/shared/lib/api/sales";
import { formatPaise } from "@/shared/lib/money";
import { normalizeIndianMobile } from "@/shared/lib/auth/phone";
import { formatBaseQuantity, type SaleUnit } from "@/shared/lib/units";

export function buildWhatsAppReceiptUrl(
  sale: SaleDTO,
  options: { storeName?: string; phone?: string } = {},
): string | null {
  const phone = normalizeIndianMobile(options.phone ?? sale.customerPhone ?? "");
  if (!phone) return null;

  const storeName = options.storeName?.trim() || "KOMOLA seller";
  const itemLines = sale.items.map(
    (item) =>
      `• ${item.name} — ${formatBaseQuantity(item.qtyBase, item.saleUnit as SaleUnit)} — ${formatPaise(item.netPaise)}`,
  );
  const message = [
    `Receipt from ${storeName}`,
    `Receipt: ${sale.receiptNo}`,
    `Date: ${new Date(sale.soldAt).toLocaleString("en-IN")}`,
    "",
    ...itemLines,
    "",
    `Total: ${formatPaise(sale.totalPaise)}`,
    "Thank you for shopping with us!",
  ].join("\n");

  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}
