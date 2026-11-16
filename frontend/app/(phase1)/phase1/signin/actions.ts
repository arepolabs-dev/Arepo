"use server";

import { headers } from "next/headers";
import { allowedEmails, isAllowed, supabaseEnv } from "@/lib/phase1/allowlist";
import { createSessionClient } from "@/lib/phase1/supabase";

export interface SigninState {
  ok: boolean;
  message: string;
}

const SENT = "If that address is invited, a sign-in link is on its way. Check your inbox.";

export async function sendMagicLink(_prev: SigninState, formData: FormData): Promise<SigninState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, message: "Enter your email address." };
  if (!supabaseEnv()) return { ok: false, message: "Phase 1 is not configured." };

  // Only invited addresses ever get an email; everyone else sees the same reply.
  if (!isAllowed(email, allowedEmails())) return { ok: true, message: SENT };

  const h = headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    h.get("origin") ||
    `https://${h.get("host") ?? "localhost:3000"}`;
  const { error } = await createSessionClient().auth.signInWithOtp({
    email,
    // Only allowlisted addresses reach this line (checked above), so the first link creates their
    // account: no one has to add auth users by hand (16 Nov).
    options: { emailRedirectTo: `${origin}/phase1/auth/callback`, shouldCreateUser: true },
  });
  if (error) {
    console.error("phase1 magic link error:", error.message);
    return { ok: false, message: "Could not send the link. Try again in a minute." };
  }
  return { ok: true, message: SENT };
}
