"use client";

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BUCKET = "product-images";

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "uncategorized";
}

export async function uploadProductImage(file: File, categoryName: string): Promise<string> {
  if (!URL || !KEY) throw new Error("Supabase storage is not configured.");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Upload a JPG, PNG, or WebP image.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Product images must be 5 MB or smaller.");
  const client = createClient(URL, KEY);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${slug(categoryName)}/${crypto.randomUUID()}.${ext}`;
  const result = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (result.error) throw new Error(result.error.message);
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
