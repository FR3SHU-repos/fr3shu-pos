"use client";

import React from "react";
import type { Producer, SupplierDTO } from "@/shared/lib/api/products";
import { inputCls } from "@/shared/components/ui";
import { cx } from "@/shared/lib/utils";

const NEW = "__new__";

/**
 * "Where is this from?" — the product's farmer/supplier, backed by the org's
 * pos.suppliers directory. "Self" = the seller's own farm; otherwise pick an
 * existing farmer or add a new one (name + optional phone and village).
 */
export function ProducerFields({
  value,
  onChange,
  suppliers,
}: {
  value: Producer;
  onChange: (next: Producer) => void;
  suppliers: SupplierDTO[];
}) {
  const others = suppliers.filter((s) => !s.isSelf);
  const isSelf = value.kind === "self";
  const addingNew = value.kind === "supplier" && !value.supplierId;
  const picked = others.find((s) => s.id === value.supplierId);

  function chooseAnother() {
    if (others.length > 0) onChange({ kind: "supplier", supplierId: others[0].id });
    else onChange({ kind: "supplier", name: "" });
  }

  function onSelect(id: string) {
    if (id === NEW) onChange({ kind: "supplier", name: value.name ?? "" });
    else onChange({ kind: "supplier", supplierId: id });
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 block text-xs font-medium text-foreground-body">
        Where is this from?
      </legend>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={isSelf}
          onClick={() => onChange({ kind: "self" })}
          className={btnCls(isSelf)}
        >
          Self
        </button>
        <button
          type="button"
          aria-pressed={!isSelf}
          onClick={chooseAnother}
          className={btnCls(!isSelf)}
        >
          Another farmer / supplier
        </button>
      </div>

      {isSelf ? (
        <p className="text-xs text-foreground-muted">Grown or made on your own farm.</p>
      ) : (
        <div className="space-y-2">
          <select
            className={inputCls}
            aria-label="Farmer or supplier"
            value={addingNew ? NEW : value.supplierId}
            onChange={(e) => onSelect(e.target.value)}
          >
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.village ? ` — ${s.village}` : ""}
              </option>
            ))}
            <option value={NEW}>＋ Add a new farmer</option>
          </select>

          {addingNew ? (
            <>
              <input
                className={inputCls}
                placeholder="Farmer / supplier name"
                aria-label="New farmer name"
                required
                value={value.name ?? ""}
                onChange={(e) => onChange({ ...value, kind: "supplier", name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="Phone (optional)"
                  aria-label="New farmer phone"
                  value={value.phone ?? ""}
                  onChange={(e) => onChange({ ...value, kind: "supplier", phone: e.target.value })}
                />
                <input
                  className={inputCls}
                  placeholder="Village (optional)"
                  aria-label="New farmer village"
                  value={value.village ?? ""}
                  onChange={(e) => onChange({ ...value, kind: "supplier", village: e.target.value })}
                />
              </div>
            </>
          ) : picked ? (
            <p className="text-xs text-foreground-muted">
              {[picked.phone, picked.village].filter(Boolean).join(" · ") || "No contact details on file"}
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}

function btnCls(active: boolean) {
  return cx(
    "min-h-11 rounded-lg border px-3 text-sm font-medium transition",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-surface-card text-foreground-body hover:bg-surface",
  );
}

/** Normalises form state into the API shape. */
export function toProducerPayload(p: Producer): Producer {
  if (p.kind === "self") return { kind: "self" };
  if (p.supplierId) return { kind: "supplier", supplierId: p.supplierId };
  return {
    kind: "supplier",
    name: (p.name ?? "").trim(),
    phone: (p.phone ?? "").trim() || undefined,
    village: (p.village ?? "").trim() || undefined,
  };
}
