import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM for Gmail refresh tokens at rest. The key is PHASE1_TOKEN_KEY: 32 bytes, base64 or hex.
 * Stored form: "v1.<iv>.<tag>.<ciphertext>" (base64url). Server only.
 */

export function tokenKey(raw = process.env.PHASE1_TOKEN_KEY): Buffer | null {
  const v = raw?.trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  const b = Buffer.from(v, "base64");
  return b.length === 32 ? b : null;
}

const b64u = (b: Buffer) => b.toString("base64url");

export function encryptToken(plain: string, key = tokenKey()): string {
  if (!key) throw new Error("PHASE1_TOKEN_KEY is not set (need 32 bytes, base64 or hex)");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join(".");
}

export function decryptToken(stored: string, key = tokenKey()): string {
  if (!key) throw new Error("PHASE1_TOKEN_KEY is not set (need 32 bytes, base64 or hex)");
  const [v, iv, tag, ct] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised token format");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

/** Signed OAuth state so the callback can trust what connect started. */
export function signState(payload: string, key = tokenKey()): string {
  if (!key) throw new Error("PHASE1_TOKEN_KEY is not set");
  const mac = createHmac("sha256", key).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export function verifyState(state: string, key = tokenKey()): string | null {
  if (!key) return null;
  const [p, mac] = state.split(".");
  if (!p || !mac) return null;
  const payload = Buffer.from(p, "base64url").toString("utf8");
  const want = createHmac("sha256", key).update(payload).digest();
  const got = Buffer.from(mac, "base64url");
  return got.length === want.length && timingSafeEqual(got, want) ? payload : null;
}
