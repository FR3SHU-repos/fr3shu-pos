"use client";

import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "komola:pwa-install-dismissed:v1";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function isAppleMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [appleMobile, setAppleMobile] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      /* Continue without a dismissal preference if storage is unavailable. */
    }
    if (dismissed) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isAppleMobile()) {
      setAppleMobile(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      /* Dismiss for this render even when storage is unavailable. */
    }
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "accepted") setVisible(false);
  };

  return (
    <aside
      className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground-body shadow-sm"
      aria-label="Install KOMOLA POS"
    >
      <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground-heading">Install KOMOLA POS</p>
        {appleMobile ? (
          <p className="mt-1 text-foreground-muted">
            Tap <Share2 className="mx-0.5 inline h-4 w-4 align-text-bottom" aria-hidden="true" />{" "}
            Share, then choose <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="mt-1 text-foreground-muted">
            Open POS faster in its own app window on this device.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {installEvent ? (
            <button
              type="button"
              onClick={() => void install()}
              className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground hover:bg-primary-hover"
            >
              Install app
            </button>
          ) : null}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg border border-border bg-surface-card px-3 py-2 font-medium text-foreground-body hover:bg-surface"
          >
            Not now
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install message"
        className="rounded-lg p-1 text-foreground-muted hover:bg-surface-card hover:text-foreground-body"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </aside>
  );
}
