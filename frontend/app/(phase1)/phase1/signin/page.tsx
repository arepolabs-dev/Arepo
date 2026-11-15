import { isTestMode, supabaseEnv } from "@/lib/phase1/allowlist";
import { SigninForm } from "./SigninForm";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_invited: "Not invited. This address is not on the list for Phase 1.",
  link: "That sign-in link did not work or has expired. Request a new one.",
};

export default function SigninPage({ searchParams }: { searchParams: { error?: string } }) {
  const testMode = isTestMode();
  const configured = testMode || supabaseEnv() !== null;
  const error = searchParams.error ? ERRORS[searchParams.error] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <p className="font-display text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-arepo-ink">
          Arepo Labs
        </p>
        <h1 className="mt-3 text-2xl font-medium text-arepo-ink">Phase 1</h1>
        <div className="mt-6 rounded-card border border-arepo-border bg-arepo-surface p-5 shadow-arepo-sm">
          {!configured ? (
            <p data-testid="not-configured" className="text-sm text-arepo-ink2">
              Phase 1 is not configured. The Supabase settings are missing on this deployment.
            </p>
          ) : testMode ? (
            <>
              <p className="text-sm text-arepo-ink2">Test mode. No email is sent.</p>
              <a
                href="/phase1/auth/callback?test=1"
                className="mt-4 block w-full rounded-control bg-arepo-ink px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Sign in as the test user
              </a>
            </>
          ) : (
            <SigninForm />
          )}
        </div>
        {error ? (
          <p role="alert" data-testid="signin-error" className="mt-4 text-sm text-arepo-neg">
            {error}
          </p>
        ) : null}
        <p className="mt-6 text-xs text-arepo-muted">Private. Invited addresses only.</p>
      </div>
    </main>
  );
}
