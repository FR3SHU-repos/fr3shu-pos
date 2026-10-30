"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import toast from "react-hot-toast";
import { productsApi } from "@/shared/lib/api";
import type { ProductDTO } from "@/shared/lib/api/products";
import type { CartLine, HeldCart } from "@/shared/components/pos/types";
import { loadHeldCarts, saveHeldCarts } from "@/shared/lib/offline/held-carts";
import type { OfflineScope } from "@/shared/lib/offline/sales";
import { formatPaise } from "@/shared/lib/money";
import { defaultBaseMetadata, measurementValue, preferredMeasurementUnit } from "@/shared/lib/units";
import { newUuid } from "@/shared/lib/uuid";
import { lineBasePerSaleUnit, lineBaseUnit, lineUnitPricePaise } from "@/shared/lib/pos/cart-lines";

interface Options {
  offlineScope: OfflineScope | null;
  lines: CartLine[];
  netPaise: number;
  catalog: ProductDTO[];
  setLines: Dispatch<SetStateAction<CartLine[]>>;
  /** Called after a cart is parked so the register returns to a blank sale. */
  onHeld: () => void;
}

/** Parked ("held") carts persisted on this device. */
export function useHeldCarts({ offlineScope, lines, netPaise, catalog, setLines, onHeld }: Options) {
  const [held, setHeld] = useState<HeldCart[]>([]);

  useEffect(() => {
    if (!offlineScope) {
      return;
    }
    let current = true;
    void loadHeldCarts(offlineScope)
      .then((carts) => { if (current) setHeld(carts); })
      .catch(() => { if (current) toast.error("Held carts could not be loaded on this device."); });
    return () => { current = false; };
  }, [offlineScope]);

  async function persistHeld(next: HeldCart[]) {
    if (!offlineScope) throw new Error("Seller scope is not ready.");
    await saveHeldCarts(offlineScope, next);
    setHeld(next);
  }

  async function holdCart() {
    if (lines.length === 0) return;
    const entry: HeldCart = {
      id: newUuid(),
      label: `${lines.length} item(s) · ${formatPaise(netPaise)}`,
      savedAt: new Date().toISOString(),
      lines: lines.map((l) => ({
        productId: l.product._id,
        qty: l.qty,
        saleUnit: l.saleUnit,
        baseUnit: lineBaseUnit(l),
        basePerSaleUnit: lineBasePerSaleUnit(l),
        measurementUnit: l.measurementUnit,
        measurementValue: l.measurementValue,
        unitPricePaise: lineUnitPricePaise(l),
        priceOverridden: l.priceOverridden,
        discountPaise: l.discountPaise,
      })),
    };
    try {
      await persistHeld([entry, ...held].slice(0, 10));
    } catch {
      toast.error("Cart could not be held safely on this device.");
      return;
    }
    onHeld();
    toast.success("Cart held");
  }

  async function resumeCart(entry: HeldCart) {
    const restored: CartLine[] = [];
    for (const l of entry.lines) {
      const visibleProduct = catalog.find((p) => p._id === l.productId);
      const product = visibleProduct ?? (await productsApi.get(l.productId)).data;
      if (!product) {
        toast.error("This held cart cannot be resumed until all of its products are available.");
        return;
      }
      const restoredBaseUnit = l.baseUnit ?? product.baseUnit ?? defaultBaseMetadata(l.saleUnit).baseUnit;
      const restoredFactor = l.basePerSaleUnit ?? product.basePerSaleUnit;
      const restoredMeasurementUnit = l.measurementUnit ?? preferredMeasurementUnit(restoredBaseUnit, restoredFactor, l.saleUnit);
      restored.push({ key: newUuid(), product, qty: l.qty, saleUnit: l.saleUnit, baseUnit: restoredBaseUnit, basePerSaleUnit: restoredFactor, measurementUnit: restoredMeasurementUnit, measurementValue: l.measurementValue ?? measurementValue(restoredFactor, restoredMeasurementUnit), unitPricePaise: l.unitPricePaise, priceOverridden: l.priceOverridden, discountPaise: l.discountPaise });
    }
    try {
      await persistHeld(held.filter((h) => h.id !== entry.id));
    } catch {
      toast.error("Held cart could not be updated on this device.");
      return;
    }
    setLines(restored);
    toast.success("Cart resumed");
  }

  return { held, holdCart, resumeCart };
}
