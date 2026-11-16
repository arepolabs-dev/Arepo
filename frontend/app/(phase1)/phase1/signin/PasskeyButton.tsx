"use client";

import { useState } from "react";
import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";

export function PasskeyButton({ next }: { next: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signIn() {
    setBusy(true);
    setMessage("");
    try {
      if (!browserSupportsWebAuthn()) throw new Error("This browser does not support passkeys.");
      const o = await fetch("/phase1/api/auth/passkey/login-options", { method: "POST" });
      if (!o.ok) throw new Error("Could not start sign-in. Try again in a minute.");
      const response = await startAuthentication({ optionsJSON: await o.json() });
      const v = await fetch("/phase1/api/auth/passkey/login-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (!v.ok) throw new Error("That passkey was not accepted.");
      window.location.assign(next);
    } catch (e) {
      const cancelled = e instanceof Error && e.name === "NotAllowedError";
      setMessage(cancelled ? "Sign-in was cancelled." : e instanceof Error ? e.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="w-full rounded-control bg-arepo-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-arepo-ink2 disabled:opacity-60"
      >
        {busy ? "Waiting for your passkey…" : "Sign in with passkey"}
      </button>
      {message ? (
        <p role="status" data-testid="signin-message" className="mt-3 text-sm text-arepo-neg">
          {message}
        </p>
      ) : null}
    </div>
  );
}
