"use client";

import { useEffect } from "react";

// Last-resort boundary: replaces the root layout, so it brings its own <html>,
// <body> and inline styles (the app stylesheet may be what failed).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0e0f11", color: "#f4f4f5", fontFamily: "system-ui, sans-serif" }}>
        <div role="alert" style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.75, margin: "0 0 20px" }}>
            KOMOLA hit an unexpected problem. Your saved data is safe.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#f15d36", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
