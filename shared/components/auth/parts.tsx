"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export const INPUT_CLS =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground-heading placeholder:text-foreground-muted outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10";

/** Accessible password field with a visibility toggle. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
  required = true,
  describedById,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  describedById?: string;
}) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground-body">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
          aria-describedby={describedById}
          className={INPUT_CLS + " pr-11"}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted transition hover:text-foreground-body focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/** 0–4 strength score with guidance text. */
export function passwordScore(pw: string): { score: number; label: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return { score: Math.min(s, 4), label: labels[Math.min(s, 4)] };
}

export function StrengthMeter({ password }: { password: string }) {
  const { score, label } = passwordScore(password);
  const colors = ["bg-border", "bg-red-400", "bg-amber-400", "bg-lime-500", "bg-green-600"];
  return (
    <div className="mt-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score] : "bg-border"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-foreground-muted">
        Password strength: <span className="font-medium">{label}</span>. Use at least
        8 characters with a mix of cases, a number and a symbol.
      </p>
    </div>
  );
}

/** "Continue with Google" — gated by NEXT_PUBLIC_AUTH_GOOGLE_ENABLED. */
export function GoogleButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  const enabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled || loading}
      aria-disabled={!enabled || loading}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface py-3 text-sm font-medium text-foreground-heading transition hover:bg-surface-card disabled:opacity-60"
    >
      <GoogleGlyph />
      {loading ? "Connecting…" : "Continue with Google"}
      {!enabled && <span className="text-xs text-foreground-muted">(unavailable)</span>}
    </button>
  );
}

/** "Continue with WhatsApp" — disabled pill while the feature flag is off. */
export function WhatsAppButton() {
  const enabled = process.env.NEXT_PUBLIC_AUTH_WHATSAPP_ENABLED === "true";
  return (
    <button
      type="button"
      disabled={!enabled}
      aria-disabled={!enabled}
      title={enabled ? undefined : "Coming soon"}
      className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-surface py-3 text-sm font-medium text-foreground-heading transition hover:bg-surface-card disabled:cursor-not-allowed disabled:opacity-60"
    >
      Continue with WhatsApp
      {!enabled && (
        <span className="rounded-full bg-border px-2 py-0.5 text-xs text-foreground-muted">
          Coming soon
        </span>
      )}
    </button>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-foreground-muted">or</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
