import type { BuyerReceiptDetail } from "@/shared/lib/api/receipts";

const PRIMARY: [number, number, number] = [255, 87, 51];
const INK: [number, number, number] = [28, 25, 23];
const MUTED: [number, number, number] = [120, 113, 108];
const BORDER: [number, number, number] = [225, 215, 210];

function money(minor: number): string {
  return `Rs. ${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function safeFilename(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || "KOMOLA-receipt";
}

export async function createBuyerReceiptPdf(receipt: BuyerReceiptDetail) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const left = 18;
  const right = width - 18;
  const contentWidth = right - left;
  let y = 0;

  const header = () => {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, width, height, "F");
    pdf.setFillColor(...PRIMARY);
    pdf.rect(0, 0, width, 31, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("KOMOLA", left, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("VERIFIED E-RECEIPT", left, 21);
    y = 42;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed <= height - 22) return;
    pdf.addPage();
    header();
  };

  const rule = () => {
    pdf.setDrawColor(...BORDER);
    pdf.line(left, y, right, y);
    y += 5;
  };

  header();
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(receipt.storeName || "KOMOLA Seller", left, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...MUTED);
  pdf.text(receipt.locationName || "", left, y);
  y += 9;

  const meta = [
    ["Receipt", receipt.receiptNo],
    ["Purchased", new Date(receipt.purchasedAt).toLocaleString("en-IN")],
    ...(receipt.customerName ? [["Customer", receipt.customerName]] : []),
    ["Status", receipt.status],
  ];
  for (const [label, value] of meta) {
    pdf.setTextColor(...MUTED);
    pdf.text(label, left, y);
    pdf.setTextColor(...INK);
    pdf.text(String(value), right, y, { align: "right", maxWidth: contentWidth - 32 });
    y += 6;
  }
  y += 2;
  rule();

  pdf.setFillColor(249, 245, 242);
  pdf.roundedRect(left, y, contentWidth, 9, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...INK);
  pdf.text("Item", left + 3, y + 6);
  pdf.text("Amount", right - 3, y + 6, { align: "right" });
  y += 14;

  receipt.lines.forEach((line) => {
    const names = pdf.splitTextToSize(line.name, 105) as string[];
    const rowHeight = Math.max(13, names.length * 4.5 + 7);
    ensureSpace(rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(names, left, y);
    pdf.text(money(line.totalMinor), right, y, { align: "right" });
    y += names.length * 4.5 + 1;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(`${line.quantity} ${line.unit} x ${money(line.unitPriceMinor)}`, left, y);
    if (line.discountMinor > 0) pdf.text(`Discount ${money(line.discountMinor)}`, right, y, { align: "right" });
    y += 6;
    pdf.setDrawColor(239, 232, 228);
    pdf.line(left, y, right, y);
    y += 5;
  });

  ensureSpace(46);
  const totalRow = (label: string, value: string, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(bold ? 13 : 10);
    pdf.setTextColor(...INK);
    pdf.text(label, left, y);
    pdf.text(value, right, y, { align: "right" });
    y += bold ? 8 : 6;
  };
  totalRow("Subtotal", money(receipt.subtotalMinor));
  if (receipt.discountMinor > 0) totalRow("Discount", `- ${money(receipt.discountMinor)}`);
  totalRow("Tax (included)", money(receipt.taxMinor));
  rule();
  totalRow("TOTAL", money(receipt.totalMinor), true);

  if (receipt.payments.length > 0) {
    y += 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Payment", left, y);
    y += 6;
    for (const payment of receipt.payments) {
      const method = payment.method ? payment.method[0].toUpperCase() + payment.method.slice(1) : "Payment";
      totalRow(`${method}${payment.reference ? ` - ${payment.reference}` : ""}`, money(payment.amountMinor));
    }
  }

  ensureSpace(24);
  y += 5;
  pdf.setFillColor(238, 250, 240);
  pdf.roundedRect(left, y, contentWidth, 18, 3, 3, "F");
  pdf.setTextColor(21, 128, 61);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(`${receipt.coinsEarned} Komola Coin${receipt.coinsEarned === 1 ? "" : "s"} earned`, width / 2, y + 8, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Completed KOMOLA purchase", width / 2, y + 13, { align: "center" });

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    pdf.text(`KOMOLA Organic POS  |  ${receipt.receiptNo}`, left, height - 10);
    pdf.text(`Page ${page} of ${pages}`, right, height - 10, { align: "right" });
  }

  return pdf;
}

export async function downloadBuyerReceiptPdf(receipt: BuyerReceiptDetail): Promise<void> {
  const pdf = await createBuyerReceiptPdf(receipt);
  pdf.save(`${safeFilename(receipt.receiptNo)}.pdf`);
}
