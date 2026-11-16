import { allowedEmails, isTestMode } from "@/lib/phase1/allowlist";
import { peekInvite } from "@/lib/phase1/invite";
import { rpConfig } from "@/lib/phase1/passkey";
import { inviteStore } from "@/lib/phase1/passkey-store";
import { sessionSecret } from "@/lib/phase1/session";
import { EnrolButton } from "./EnrolButton";

export const dynamic = "force-dynamic";

/** Passkey enrolment from a one-time invite link. The invite is only peeked here; it is consumed when the passkey is saved. */
export default async function EnrolPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = (searchParams.token ?? "").slice(0, 200);
  let state: "ok" | "invalid" | "unconfigured" = "invalid";
  let email = "";
  if (isTestMode() || !rpConfig() || !sessionSecret()) {
    state = "unconfigured";
  } else if (token) {
    try {
      const e = await peekInvite(inviteStore(), token, allowedEmails());
      if (e) {
        state = "ok";
        email = e;
      }
    } catch {
      state = "unconfigured";
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <p className="font-display text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-arepo-ink">
          Arepo Labs
        </p>
        <h1 className="mt-3 text-2xl font-medium text-arepo-ink">Set up your passkey</h1>
        <div className="mt-6 rounded-card border border-arepo-border bg-arepo-surface p-5 shadow-arepo-sm">
          {state === "ok" ? (
            <>
              <p className="text-sm text-arepo-ink2">
                This creates a passkey for <span className="font-medium">{email}</span> on this device. The link
                works once.
              </p>
              <div className="mt-4">
                <EnrolButton token={token} />
              </div>
            </>
          ) : state === "unconfigured" ? (
            <p data-testid="not-configured" className="text-sm text-arepo-ink2">
              Passkeys are not available on this deployment.
            </p>
          ) : (
            <p data-testid="invite-invalid" className="text-sm text-arepo-neg">
              This invite link is not valid or has expired. Ask for a new one.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
