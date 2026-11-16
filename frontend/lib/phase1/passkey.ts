/**
 * Passkey (WebAuthn) ceremonies for Phase 1, on SimpleWebAuthn. Node runtime only (route handlers),
 * never imported by the middleware. Persistence goes through the small stores in passkey-store.ts.
 */
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransport,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isAllowed } from "./allowlist";
import { sha256Hex } from "./invite";
import type { ChallengeStore, PasskeyStore } from "./passkey-store";

export const CHALLENGE_COOKIE = "phase1-challenge";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RP_NAME = "Arepo Labs Phase 1";

export interface RpConfig {
  rpID: string;
  origins: string[];
}

/** RP ID and allowed origins from env, or null when not configured. */
export function rpConfig(env: NodeJS.ProcessEnv = process.env): RpConfig | null {
  const rpID = env.PHASE1_RP_ID?.trim();
  const origins = (env.PHASE1_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (!rpID || origins.length === 0) return null;
  return { rpID, origins };
}

const b64u = {
  enc(b: Uint8Array): string {
    return Buffer.from(b).toString("base64url");
  },
  dec(s: string): Uint8Array<ArrayBuffer> {
    return new Uint8Array(Buffer.from(s, "base64url"));
  },
};

async function userHandle(email: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(Buffer.from(await sha256Hex(`phase1-user:${email}`), "hex"));
}

// ------------------------------------------------------------------ enrol

export async function beginEnrol(
  rp: RpConfig,
  challenges: ChallengeStore,
  passkeys: PasskeyStore,
  email: string,
  inviteHash: string,
  nowMs: number = Date.now(),
) {
  const existing = await passkeys.listByEmail(email);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpID,
    userName: email,
    userID: await userHandle(email),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  const challengeId = await challenges.save(
    { challenge: options.challenge, purpose: "enrol", email, invite_hash: inviteHash },
    new Date(nowMs + CHALLENGE_TTL_MS).toISOString(),
  );
  return { options, challengeId };
}

export interface VerifiedCredential {
  id: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
}

/** Verifies the registration (consuming the challenge). The route then claims the invite and stores it. */
export async function verifyEnrol(
  rp: RpConfig,
  challenges: ChallengeStore,
  challengeId: string,
  response: RegistrationResponseJSON,
  nowMs: number = Date.now(),
): Promise<{ email: string; inviteHash: string; credential: VerifiedCredential }> {
  const ch = await challenges.take(challengeId, "enrol", new Date(nowMs).toISOString());
  if (!ch || !ch.email || !ch.invite_hash) throw new Error("challenge");
  const v = await verifyRegistrationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: rp.origins,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
  });
  if (!v.verified || !v.registrationInfo) throw new Error("not verified");
  const c = v.registrationInfo.credential;
  return {
    email: ch.email,
    inviteHash: ch.invite_hash,
    credential: { id: c.id, publicKey: c.publicKey, counter: c.counter, transports: c.transports },
  };
}

export async function storeCredential(passkeys: PasskeyStore, email: string, c: VerifiedCredential) {
  await passkeys.insert({
    email,
    credential_id: c.id,
    public_key: b64u.enc(c.publicKey),
    counter: c.counter,
    transports: c.transports ?? null,
  });
}

// ------------------------------------------------------------------ login

export async function beginLogin(rp: RpConfig, challenges: ChallengeStore, nowMs: number = Date.now()) {
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
    // No allowCredentials: the browser offers the discoverable passkeys for this site.
  });
  const challengeId = await challenges.save(
    { challenge: options.challenge, purpose: "login", email: null, invite_hash: null },
    new Date(nowMs + CHALLENGE_TTL_MS).toISOString(),
  );
  return { options, challengeId };
}

/** Verifies the assertion; returns the allowlisted email to sign in, or throws. */
export async function finishLogin(
  rp: RpConfig,
  challenges: ChallengeStore,
  passkeys: PasskeyStore,
  allowlist: string[],
  challengeId: string,
  response: AuthenticationResponseJSON,
  nowMs: number = Date.now(),
): Promise<string> {
  const ch = await challenges.take(challengeId, "login", new Date(nowMs).toISOString());
  if (!ch) throw new Error("challenge");
  const row = await passkeys.findByCredentialId(response.id);
  if (!row) throw new Error("unknown credential");
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: ch.challenge,
    expectedOrigin: rp.origins,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
    credential: {
      id: row.credential_id,
      publicKey: b64u.dec(row.public_key),
      counter: Number(row.counter),
      transports: (row.transports ?? undefined) as AuthenticatorTransport[] | undefined,
    },
  });
  if (!v.verified) throw new Error("not verified");
  if (!isAllowed(row.email, allowlist)) throw new Error("not invited");
  await passkeys.touch(row.credential_id, v.authenticationInfo.newCounter, new Date(nowMs).toISOString());
  return row.email.trim().toLowerCase();
}
