"use client";

import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { OFFLINE_SALES_SYNC_EVENT, type OfflineSalesSyncDetail } from "@/shared/components/pos/OfflineSalesSyncWorker";

type ConnectionState = "online" | "offline" | "server" | "sync" | "auth";

function currentOnlineState(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function PwaStatusBar() {
  const [online, setOnline] = useState(currentOnlineState);
  const [state, setState] = useState<Exclude<ConnectionState, "online" | "offline"> | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      setState(null);
    };
    const onOffline = () => {
      setOnline(false);
      setState(null);
    };
    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<OfflineSalesSyncDetail>).detail;
      if (detail.authRequired) setState("auth");
      else if (detail.unavailable) setState("server");
      else if (detail.attempted > detail.synced || detail.blocked > 0) setState("sync");
      else if (detail.synced > 0) setState(null);
    };
    const onUpdate = () => setUpdateReady(true);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OFFLINE_SALES_SYNC_EVENT, onSync);
    window.addEventListener("komola:pwa-update-ready", onUpdate);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OFFLINE_SALES_SYNC_EVENT, onSync);
      window.removeEventListener("komola:pwa-update-ready", onUpdate);
    };
  }, []);

  const connectionState: ConnectionState = !online ? "offline" : state ?? "online";
  const content = {
    online: { icon: CheckCircle2, label: "Online", className: "text-status-success" },
    offline: { icon: CloudOff, label: "Offline · local data only", className: "text-status-warning" },
    server: { icon: AlertTriangle, label: "Server unavailable · retrying later", className: "text-status-danger" },
    sync: { icon: RefreshCw, label: "Online · pending sync needs attention", className: "text-status-warning" },
    auth: { icon: ShieldAlert, label: "Sign in again to sync pending sales", className: "text-status-danger" },
  }[connectionState];
  const Icon = content.icon;

  return (
    <div className="mb-4 space-y-2">
      {updateReady ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-foreground-body" role="status">
          <span>A new KOMOLA POS version is ready.</span>
          <button type="button" onClick={() => window.dispatchEvent(new Event("komola:pwa-activate-update"))} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 font-semibold text-primary-foreground hover:bg-primary-hover">
            Refresh
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-end" role="status" aria-live="polite">
        <span className={`inline-flex items-center gap-1.5 rounded-full bg-surface-card px-3 py-1.5 text-xs font-medium shadow-sm ${content.className}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {content.label}
        </span>
      </div>
    </div>
  );
}
