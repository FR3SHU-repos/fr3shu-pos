"use client";

import { useEffect, useRef } from "react";

/** Counter shortcuts: F2 starts payment, F4 returns to product search. */
export function usePosShortcuts(handlers: { pay: () => void; focusSearch: () => void }) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F2") {
        event.preventDefault();
        ref.current.pay();
      } else if (event.key === "F4") {
        event.preventDefault();
        ref.current.focusSearch();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
