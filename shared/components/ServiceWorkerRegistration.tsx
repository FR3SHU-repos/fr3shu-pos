"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let disposed = false;

    const watchForUpdates = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        window.dispatchEvent(new Event("komola:pwa-update-ready"));
      }
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (disposed || worker.state !== "installed" || !navigator.serviceWorker.controller) return;
        window.dispatchEvent(new Event("komola:pwa-update-ready"));
      });
    };

    const activateUpdate = () => {
      void navigator.serviceWorker.getRegistration().then((current) => {
        current?.waiting?.postMessage({ type: "SKIP_WAITING" });
      });
    };
    const reloadAfterActivation = () => window.location.reload();
    window.addEventListener("komola:pwa-activate-update", activateUpdate);
    navigator.serviceWorker.addEventListener("controllerchange", reloadAfterActivation, { once: true });

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (disposed) return;
        watchForUpdates(registration);
        registration.addEventListener("updatefound", () => watchForUpdates(registration));
      }).catch(() => {
        /* The UI still works online if registration is unavailable. */
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => {
      disposed = true;
      window.removeEventListener("load", register);
      window.removeEventListener("komola:pwa-activate-update", activateUpdate);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadAfterActivation);
    };
  }, []);

  return null;
}
