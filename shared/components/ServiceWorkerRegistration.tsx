"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function ServiceWorkerRegistration() {
  const pathname = usePathname();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* The UI still works online if registration is unavailable. */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    if (!pathname.startsWith("/pos") && !pathname.startsWith("/dashboard") && !pathname.startsWith("/products")) return;
    navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: "CACHE_URLS", urls: [pathname, "/pos"] });
    }).catch(() => {
      /* Offline restart remains unavailable until registration succeeds. */
    });
  }, [pathname]);

  return null;
}
