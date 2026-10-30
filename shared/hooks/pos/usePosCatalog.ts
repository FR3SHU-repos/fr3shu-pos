"use client";

import { useEffect, useState } from "react";
import { productsApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";

/** Product list for the register plus the debounced search that refreshes it. */
export function usePosCatalog() {
  const [catalog, setCatalog] = useState<ProductDTO[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const res = await productsApi.list({
        q: query.trim() || undefined,
        limit: 10,
        status: "active",
        signal: ctrl.signal,
      });
      if (res.success && res.data) setCatalog(res.data.items);
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  return { catalog, setCatalog, query, setQuery };
}
