/** Supabase-backed stores for passkeys, invites and challenges (service role; server only). */
import { createServiceClient } from "./supabase";
import type { InviteRow, InviteStore } from "./invite";

export interface PasskeyRow {
  email: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
}

export interface PasskeyStore {
  listByEmail(email: string): Promise<PasskeyRow[]>;
  findByCredentialId(id: string): Promise<PasskeyRow | null>;
  insert(row: PasskeyRow): Promise<void>;
  touch(id: string, counter: number, nowIso: string): Promise<void>;
}

export interface ChallengeRow {
  challenge: string;
  purpose: "enrol" | "login";
  email: string | null;
  invite_hash: string | null;
}

export interface ChallengeStore {
  save(row: ChallengeRow, expiresAtIso: string): Promise<string>;
  /** Single use: deletes and returns the row if it exists, matches `purpose` and has not expired. */
  take(id: string, purpose: ChallengeRow["purpose"], nowIso: string): Promise<ChallengeRow | null>;
}

function fail(e: { message: string } | null): void {
  if (e) {
    console.error("phase1 passkey db error:", e.message);
    throw new Error("Database error");
  }
}

export function passkeyStore(): PasskeyStore {
  const db = createServiceClient();
  return {
    async listByEmail(email) {
      const { data, error } = await db.from("passkeys").select("*").eq("email", email);
      fail(error);
      return (data ?? []) as PasskeyRow[];
    },
    async findByCredentialId(id) {
      const { data, error } = await db.from("passkeys").select("*").eq("credential_id", id).limit(1);
      fail(error);
      return ((data ?? [])[0] as PasskeyRow | undefined) ?? null;
    },
    async insert(row) {
      fail((await db.from("passkeys").insert(row)).error);
    },
    async touch(id, counter, nowIso) {
      fail((await db.from("passkeys").update({ counter, last_used_at: nowIso }).eq("credential_id", id)).error);
    },
  };
}

export function inviteStore(): InviteStore {
  const db = createServiceClient();
  return {
    async insert(row) {
      fail((await db.from("passkey_invites").insert(row)).error);
    },
    async find(hash) {
      const { data, error } = await db.from("passkey_invites").select("*").eq("token_hash", hash).limit(1);
      fail(error);
      return ((data ?? [])[0] as InviteRow | undefined) ?? null;
    },
    async claim(hash, nowIso) {
      const { data, error } = await db
        .from("passkey_invites")
        .update({ used_at: nowIso })
        .eq("token_hash", hash)
        .is("used_at", null)
        .gt("expires_at", nowIso)
        .select("email");
      fail(error);
      return ((data ?? [])[0] as { email: string } | undefined)?.email ?? null;
    },
    async release(hash) {
      fail((await db.from("passkey_invites").update({ used_at: null }).eq("token_hash", hash)).error);
    },
  };
}

export function challengeStore(): ChallengeStore {
  const db = createServiceClient();
  return {
    async save(row, expiresAtIso) {
      // Tidy expired rows as we go; the table stays tiny.
      await db.from("passkey_challenges").delete().lt("expires_at", new Date().toISOString());
      const { data, error } = await db
        .from("passkey_challenges")
        .insert({ ...row, expires_at: expiresAtIso })
        .select("id");
      fail(error);
      const id = (data ?? [])[0]?.id as string | undefined;
      if (!id) throw new Error("Database error");
      return id;
    },
    async take(id, purpose, nowIso) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data, error } = await db
        .from("passkey_challenges")
        .delete()
        .eq("id", id)
        .eq("purpose", purpose)
        .gt("expires_at", nowIso)
        .select("challenge,purpose,email,invite_hash");
      fail(error);
      return ((data ?? [])[0] as ChallengeRow | undefined) ?? null;
    },
  };
}
