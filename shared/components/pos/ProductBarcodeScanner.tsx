"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Camera, Loader2, ScanLine, X } from "lucide-react";
import { ghostBtnCls } from "@/shared/components/ui";

export function ProductBarcodeScanner({
  disabled,
  onScan,
}: {
  disabled?: boolean;
  onScan: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (!open || !videoRef.current) return;
    acceptedRef.current = false;
    setStarting(true);
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;
    void reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result) => {
          if (!result || acceptedRef.current) return;
          const code = result.getText().trim();
          if (!code) return;
          acceptedRef.current = true;
          controlsRef.current?.stop();
          onScan(code);
          setOpen(false);
        },
      )
      .then((controls) => {
        if (cancelled) controls.stop();
        else controlsRef.current = controls;
        setStarting(false);
      })
      .catch(() => {
        setStarting(false);
        setError("Camera unavailable. Allow camera access or search by SKU or barcode instead.");
      });
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onScan, open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        disabled={disabled}
        className={`${ghostBtnCls} shrink-0 px-3`}
        aria-label="Scan product barcode"
        title="Scan product barcode"
      >
        <ScanLine className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Scan</span>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-scanner-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2
                  id="product-scanner-title"
                  className="text-lg font-semibold text-foreground-heading"
                >
                  Scan product barcode
                </h2>
                <p className="text-sm text-foreground-muted">
                  Point the camera at a product barcode.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full hover:bg-surface"
                aria-label="Close scanner"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mt-4 aspect-square overflow-hidden rounded-2xl bg-black">
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-white/90" />
              {starting ? (
                <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            <p className="mt-3 flex items-center gap-2 text-xs text-foreground-muted">
              <Camera className="h-4 w-4" />
              Camera access is used only while this scanner is open.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
