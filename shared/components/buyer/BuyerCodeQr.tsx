"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, X } from "lucide-react";
import { ghostBtnCls } from "@/shared/components/ui";

export function BuyerCodeQr({ code }: { code: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ghostBtnCls}
        aria-label="Show buyer QR code"
      >
        <QrCode className="h-5 w-5" />
        Show QR
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="buyer-qr-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h2 id="buyer-qr-title" className="text-xl font-semibold text-foreground-heading">
                My buyer QR code
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
                aria-label="Close QR code"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mx-auto mt-5 w-fit rounded-2xl border border-border bg-white p-4">
              <QRCodeSVG value={code} size={240} level="M" marginSize={2} />
            </div>
            <p className="mt-4 font-mono text-xl font-bold tracking-wider text-foreground-heading">{code}</p>
            <p className="mt-2 text-sm text-foreground-muted">
              Ask the seller to scan this code while entering customer details.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
