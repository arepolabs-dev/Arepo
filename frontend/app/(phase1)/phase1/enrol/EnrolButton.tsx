"use client";

import { useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";

export function EnrolButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function enrol() {
    setBusy(true);
    setMessage("");
    try {
      if (!browserSupportsWebAuthn()) throw new Error("This browser does not support passkeys.");
      const o = await fetch("/phase1/api/auth/passkey/enrol-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!o.ok) throw new Error("This invite link is not valid or has expired.");
      const response = await startRegistration({ optionsJSON: await o.json() });
      const v = await fetch("/phase1/api/auth/passkey/enrol-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, response }),
      });
      if (!v.ok) throw new Error("Could not save the passkey. Ask for a new invite link.");
      window.location.assign("/phase1");
    } catch (e) {
      const cancelled = e instanceof Error && e.name === "NotAllowedError";
      setMessage(cancelled ? "Cancelled. You can try again." : e instanceof Error ? e.message : "Failed.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={enrol}
        disabled={busy}
        className="w-full rounded-control bg-arepo-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-arepo-ink2 disabled:opacity-60"
      >
        {busy ? "Waiting for your device…" : "Create passkey"}
      </button>
      {message ? (
        <p role="status" data-testid="enrol-message" className="mt-3 text-sm text-arepo-neg">
          {message}
        </p>
      ) : null}
    </div>
  );
}
