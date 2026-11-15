"use client";

import { useFormState, useFormStatus } from "react-dom";
import { sendMagicLink, type SigninState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded-control bg-arepo-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-arepo-ink2 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Email me a sign-in link"}
    </button>
  );
}

export function SigninForm() {
  const [state, action] = useFormState<SigninState, FormData>(sendMagicLink, { ok: false, message: "" });
  return (
    <form action={action}>
      <label htmlFor="email" className="block text-sm text-arepo-ink2">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        autoFocus
        className="mt-1 w-full rounded-control border border-arepo-borderStrong bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-arepo-accent/40"
      />
      <Submit />
      {state.message ? (
        <p
          role="status"
          data-testid="signin-message"
          className={`mt-3 text-sm ${state.ok ? "text-arepo-pos" : "text-arepo-neg"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
