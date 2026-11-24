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

  return new Promise((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      callback: (response) => resolve(response.credential),
    });
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        reject(new Error("Google sign-in was cancelled or could not be displayed."));
      }
    });
  });
}
