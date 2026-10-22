/**
 * The product taxonomy is platform-managed and intentionally stable.
 * Product writes send the slug; the API resolves it to the database UUID.
 */
export const CATEGORY_LIST = [
  { name: "Grains", slug: "grains", sortOrder: 10 },
  { name: "Millets", slug: "millets", sortOrder: 20 },
  { name: "Pulses & Lentils", slug: "pulses-lentils", sortOrder: 30 },
  { name: "Vegetables", slug: "vegetables", sortOrder: 40 },
  { name: "Fruits", slug: "fruits", sortOrder: 50 },
  { name: "Leafy Greens", slug: "leafy-greens", sortOrder: 60 },
  { name: "Oils & Ghee", slug: "oils-ghee", sortOrder: 70 },
  { name: "Spices & Masala", slug: "spices-masala", sortOrder: 80 },
  { name: "Dairy", slug: "dairy", sortOrder: 90 },
  { name: "Honey & Preserves", slug: "honey-preserves", sortOrder: 100 },
  { name: "Dry Fruits & Nuts", slug: "dry-fruits-nuts", sortOrder: 110 },
  { name: "Beverages", slug: "beverages", sortOrder: 120 },
  { name: "Snacks", slug: "snacks", sortOrder: 130 },
  { name: "Other", slug: "other", sortOrder: 999 },
] as const;

export type CategorySlug = (typeof CATEGORY_LIST)[number]["slug"];
