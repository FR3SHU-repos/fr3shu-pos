/**
 * Minimal, framework-free i18n for POS-critical labels only.
 * English is the source of truth; Telugu covers the core /pos screen.
 * A full i18n framework and route-based locale switching is deferred.
 */

export type Locale = "en" | "te";

export const LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "te", label: "తెలుగు" },
];

type Dict = Record<string, string>;

const en: Dict = {
  "pos.title": "Point of Sale",
  "pos.search": "Search by name, SKU or barcode",
  "pos.cart": "Cart",
  "pos.empty_cart": "Scan or search to add products",
  "pos.qty": "Quantity",
  "pos.unit": "Unit",
  "pos.subtotal": "Subtotal",
  "pos.discount": "Discount",
  "pos.tax": "Tax",
  "pos.total": "Total",
  "pos.pay": "Take payment",
  "pos.cash": "Cash",
  "pos.upi": "UPI",
  "pos.split": "Split",
  "pos.upi_ref": "UPI reference (optional)",
  "pos.amount_tendered": "Amount tendered",
  "pos.change_due": "Change due",
  "pos.complete_sale": "Complete sale",
  "pos.sale_complete": "Sale complete",
  "pos.new_sale": "New sale",
  "pos.print_receipt": "Print receipt",
  "pos.hold": "Hold",
  "pos.resume": "Resume held cart",
  "pos.customer_phone": "Customer phone (optional)",
  "pos.no_register": "Open a register session before selling.",
  "pos.lot": "Lot",
  "pos.remove": "Remove",
  "pos.organic_verified": "Organic verified",
  "pos.organic_unverified": "Not verified organic",
};

const te: Dict = {
  "pos.title": "పాయింట్ ఆఫ్ సేల్",
  "pos.search": "పేరు, SKU లేదా బార్‌కోడ్‌తో వెతకండి",
  "pos.cart": "బండి",
  "pos.empty_cart": "ఉత్పత్తులను జోడించడానికి స్కాన్ చేయండి లేదా వెతకండి",
  "pos.qty": "పరిమాణం",
  "pos.unit": "యూనిట్",
  "pos.subtotal": "ఉప మొత్తం",
  "pos.discount": "తగ్గింపు",
  "pos.tax": "పన్ను",
  "pos.total": "మొత్తం",
  "pos.pay": "చెల్లింపు తీసుకోండి",
  "pos.cash": "నగదు",
  "pos.upi": "UPI",
  "pos.split": "విభజన",
  "pos.upi_ref": "UPI రిఫరెన్స్ (ఐచ్ఛికం)",
  "pos.amount_tendered": "ఇచ్చిన మొత్తం",
  "pos.change_due": "తిరిగి ఇవ్వాల్సినది",
  "pos.complete_sale": "అమ్మకం పూర్తి చేయండి",
  "pos.sale_complete": "అమ్మకం పూర్తయింది",
  "pos.new_sale": "కొత్త అమ్మకం",
  "pos.print_receipt": "రసీదు ముద్రించండి",
  "pos.hold": "నిలిపివేయి",
  "pos.resume": "నిలిపిన బండిని కొనసాగించండి",
  "pos.customer_phone": "కస్టమర్ ఫోన్ (ఐచ్ఛికం)",
  "pos.no_register": "అమ్మకానికి ముందు రిజిస్టర్ సెషన్ తెరవండి.",
  "pos.lot": "లాట్",
  "pos.remove": "తీసివేయి",
  "pos.organic_verified": "సేంద్రియ ధృవీకరించబడింది",
  "pos.organic_unverified": "సేంద్రియంగా ధృవీకరించబడలేదు",
};

const DICTS: Record<Locale, Dict> = { en, te };

export function translator(locale: Locale) {
  const dict = DICTS[locale] ?? en;
  return (key: string): string => dict[key] ?? en[key] ?? key;
}
