/** Mailbox access for the Gmail routes: who may use which mailbox, and a fresh access token or a reconnect. */
import { decryptToken, encryptToken } from "./crypto";
import { GmailAuthError, gmailConfig, refreshAccessToken } from "./gmail";
import type { Phase1Db } from "./supabase";
import type { Mailbox, Phase1User } from "./types";
import { ActionError } from "./actions";

/** A personal mailbox belongs to its owner; the shared one is open to every signed-in allowed user. */
export function canUse(m: Mailbox, user: Phase1User): boolean {
  return m.kind === "shared" || m.owner_id === user.personId;
}

export async function findMailbox(db: Phase1Db, user: Phase1User, id: string): Promise<Mailbox> {
  const m = (await db.select("mailboxes", { eq: { id } }))[0];
  if (!m || !canUse(m, user)) throw new ActionError(404, "Mailbox not found");
  return m;
}

export class ReconnectError extends Error {
  constructor(public mailboxId: string) {
    super("Reconnect Gmail");
  }
}

/** An access token for the mailbox. On invalid_grant (7-day Testing-mode expiry) flags needs_reconnect. */
export async function accessTokenFor(db: Phase1Db, m: Mailbox): Promise<string> {
  const cfg = gmailConfig();
  if (!cfg) throw new ActionError(400, "Gmail is not configured");
  if (!m.refresh_token_enc || m.status === "needs_reconnect") throw new ReconnectError(m.id);
  try {
    return await refreshAccessToken(cfg, decryptToken(m.refresh_token_enc));
  } catch (e) {
    if (e instanceof GmailAuthError) {
      await db.update("mailboxes", { id: m.id }, { status: "needs_reconnect", last_error: "Google asked to sign in again" });
      throw new ReconnectError(m.id);
    }
    throw e;
  }
}

export { encryptToken };
