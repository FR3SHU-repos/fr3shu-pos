"use client";

type GooglePromptNotification = {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
};

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
        cancel_on_tap_outside?: boolean;
        use_fedcm_for_prompt?: boolean;
      }) => void;
      prompt: (listener?: (notification: GooglePromptNotification) => void) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let initializedClientId: string | null = null;
let pendingToken: {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
} | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Identity Services could not load.")),
        { once: true },
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Identity Services could not load."));
    document.head.appendChild(script);
  });
}

export async function getGoogleWebIdToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!clientId) throw new Error("Web Google Sign-In is not configured.");
  await loadGoogleIdentityScript();
  const google = window.google;
  if (!google) throw new Error("Google Identity Services is unavailable.");

  if (initializedClientId !== clientId) {
    if (pendingToken) {
      clearTimeout(pendingToken.timeout);
      pendingToken.reject(new Error("Google sign-in was restarted."));
      pendingToken = null;
    }
    google.accounts.id.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      callback: (response) => {
        if (!pendingToken) return;
        clearTimeout(pendingToken.timeout);
        pendingToken.resolve(response.credential);
        pendingToken = null;
      },
    });
    initializedClientId = clientId;
  }

  if (pendingToken) {
    return Promise.reject(new Error("Google sign-in is already in progress."));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!pendingToken) return;
      pendingToken = null;
      reject(new Error("Google sign-in timed out or was cancelled."));
    }, 60_000);
    pendingToken = { resolve, reject, timeout };
    // Do not inspect prompt notification status here. Those deprecated status
    // methods produce FedCM migration warnings in current Google browsers.
    google.accounts.id.prompt();
  });
}
