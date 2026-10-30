/**
 * Small, local-only diagnostics for the offline pilot. This is deliberately
 * stored in sessionStorage: it contains no sale data and is not sent anywhere.
 * It helps measure refresh frequency, sync latency, retries, and upload size
 * on representative mobile devices before adding a remote telemetry pipeline.
 */
export interface OfflineNetworkMetrics {
  sessionStartedAt: string;
  catalogueRefreshes: number;
  downloadedBytes: number;
  syncAttempts: number;
  retryCount: number;
  uploadBytes: number;
  totalSyncLatencyMs: number;
}

const STORAGE_KEY = "komola:offline-network-metrics:v1";

function empty(): OfflineNetworkMetrics {
  return {
    sessionStartedAt: new Date().toISOString(),
    catalogueRefreshes: 0,
    downloadedBytes: 0,
    syncAttempts: 0,
    retryCount: 0,
    uploadBytes: 0,
    totalSyncLatencyMs: 0,
  };
}

export function readOfflineNetworkMetrics(): OfflineNetworkMetrics {
  if (typeof window === "undefined") return empty();
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<OfflineNetworkMetrics> | null;
    return { ...empty(), ...parsed };
  } catch {
    return empty();
  }
}

function update(patch: Partial<OfflineNetworkMetrics>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readOfflineNetworkMetrics(), ...patch }),
    );
  } catch {
    /* diagnostics must never affect checkout */
  }
}

export function recordCatalogueRefresh(downloadedBytes = 0) {
  const current = readOfflineNetworkMetrics();
  update({
    catalogueRefreshes: current.catalogueRefreshes + 1,
    downloadedBytes: current.downloadedBytes + Math.max(0, downloadedBytes),
  });
}

export function recordOfflineSyncAttempt(durationMs: number, uploadBytes: number, retry: boolean) {
  const current = readOfflineNetworkMetrics();
  update({
    syncAttempts: current.syncAttempts + 1,
    retryCount: current.retryCount + (retry ? 1 : 0),
    uploadBytes: current.uploadBytes + Math.max(0, uploadBytes),
    totalSyncLatencyMs: current.totalSyncLatencyMs + Math.max(0, durationMs),
  });
}

export function jsonByteLength(value: unknown): number {
  const json = JSON.stringify(value);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).byteLength;
  return json.length;
}
