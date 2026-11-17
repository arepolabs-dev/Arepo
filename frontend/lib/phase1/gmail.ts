/**
 * Gmail over plain fetch (no googleapis). OAuth connects a PERSONAL Gmail account per person (and one shared
 * enquiries account). Mail goes out as the person's arepolabs address through a verified Gmail "Send mail as"
 * alias; replies reach the personal Gmail by Cloudflare forwarding. Refresh tokens last 7 days while the Google
 * app is in Testing mode, so invalid_grant means "Reconnect Gmail", never a crash.
 */
import { emailHtml, emailText } from "./signature";
import { randomUUID } from "node:crypto";
import { tokenKey } from "./crypto";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
}

/** Null when the Google client or the token key is missing: the dashboard then uses "Open in mail app". */
export function gmailConfig(): GmailConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || !tokenKey()) return null;
  return { clientId, clientSecret };
}

export function missingGmailEnv(): string[] {
  const out: string[] = [];
  if (!process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()) out.push("GOOGLE_OAUTH_CLIENT_ID");
  if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()) out.push("GOOGLE_OAUTH_CLIENT_SECRET");
  if (!tokenKey()) out.push("PHASE1_TOKEN_KEY");
  return out;
}

/** The shared enquiries address (a free Gmail account both people sign into). */
export function sharedAddress(): string {
  return (process.env.PHASE1_SHARED_ADDRESS?.trim() || "enquiries@arepolabs.com").toLowerCase();
}

export function redirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/phase1/api/gmail/callback`;
}

export function buildAuthUrl(cfg: GmailConfig, origin: string, state: string, loginHint?: string): string {
  const u = new URL(AUTH);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("redirect_uri", redirectUri(origin));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GMAIL_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  if (loginHint) u.searchParams.set("login_hint", loginHint);
  return u.toString();
}

/** The refresh token was revoked or expired (7 days in Testing mode): the person must reconnect. */
export class GmailAuthError extends Error {
  constructor(message = "Gmail needs to be reconnected") {
    super(message);
    this.name = "GmailAuthError";
  }
}

export class GmailApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

async function tokenCall(cfg: GmailConfig, params: Record<string, string>): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string; access_token?: string; refresh_token?: string; scope?: string };
  if (!res.ok || !j.access_token) {
    if (j.error === "invalid_grant") throw new GmailAuthError();
    throw new GmailApiError(res.status, `Google token error: ${j.error ?? res.status}`);
  }
  return { access_token: j.access_token, refresh_token: j.refresh_token, scope: j.scope };
}

export const exchangeCode = (cfg: GmailConfig, code: string, origin: string) =>
  tokenCall(cfg, { grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });

export async function refreshAccessToken(cfg: GmailConfig, refreshToken: string): Promise<string> {
  return (await tokenCall(cfg, { grant_type: "refresh_token", refresh_token: refreshToken })).access_token;
}

async function api<T>(access: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { authorization: `Bearer ${access}`, "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (res.status === 401) throw new GmailAuthError();
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new GmailApiError(res.status, `Gmail ${res.status}: ${t.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export interface SendAs {
  sendAsEmail: string;
  displayName?: string;
  verificationStatus?: string;
  isPrimary?: boolean;
}

export const getProfile = (access: string) => api<{ emailAddress: string; historyId: string }>(access, "/profile");
export const listSendAs = async (access: string) => (await api<{ sendAs?: SendAs[] }>(access, "/settings/sendAs")).sendAs ?? [];

/** A "Send mail as" alias is usable once Gmail has verified it (accepted, or the primary address). */
export function findAlias(list: SendAs[], address: string): { found: boolean; verified: boolean; displayName?: string } {
  const a = list.find((x) => x.sendAsEmail.toLowerCase() === address.toLowerCase());
  if (!a) return { found: false, verified: false };
  return { found: true, verified: a.isPrimary === true || !a.verificationStatus || a.verificationStatus === "accepted", displayName: a.displayName };
}

// ---------------------------------------------------------------- sending

function encodeHeader(v: string): string {
  // RFC 2047 for anything outside ASCII (e.g. the pound sign).
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\x7f]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, "utf8").toString("base64")}?=`;
}

export interface MimeInput {
  fromName: string;
  fromAddress: string;
  to: string;
  subject: string;
  body: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

const b64 = (s: string) => (Buffer.from(s, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");

/** multipart/alternative MIME message: the plain text exactly as written, plus an HTML twin (see html-email.ts); returns the raw text and the RFC Message-ID we set (stored for reply matching). */
export function buildMime(m: MimeInput): { raw: string; messageId: string } {
  const messageId = m.messageId ?? `<${randomUUID()}@arepolabs.com>`;
  const boundary = `tenet_${randomUUID().replace(/-/g, "")}`;
  const name = m.fromName ? `${encodeHeader(m.fromName)} ` : "";
  const lines = [
    `From: ${name}<${m.fromAddress}>`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    ...(m.inReplyTo ? [`In-Reply-To: ${m.inReplyTo}`] : []),
    ...(m.references ? [`References: ${m.references}`] : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(emailText(m.body, m.fromAddress).replace(/\r?\n/g, "\r\n")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    b64(emailHtml(m.body, m.fromAddress)),
    `--${boundary}--`,
    "",
  ];
  return { raw: lines.join("\r\n"), messageId };
}

export async function sendRaw(access: string, raw: string, threadId?: string): Promise<{ id: string; threadId: string }> {
  return api(access, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: Buffer.from(raw, "utf8").toString("base64url"), ...(threadId ? { threadId } : {}) }),
  });
}

// ---------------------------------------------------------------- reading

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  historyId?: string;
  payload?: GmailPart;
}

export const listMessageIds = async (access: string, q: string, max = 200): Promise<string[]> => {
  const out: string[] = [];
  let pageToken: string | undefined;
  do {
    const u = new URLSearchParams({ q, maxResults: "100" });
    if (pageToken) u.set("pageToken", pageToken);
    const r = await api<{ messages?: { id: string }[]; nextPageToken?: string }>(access, `/messages?${u}`);
    out.push(...(r.messages ?? []).map((m) => m.id));
    pageToken = r.nextPageToken;
  } while (pageToken && out.length < max);
  return out.slice(0, max);
};

/** Message ids added since `startHistoryId`; null if Gmail no longer has that history (re-list instead). */
export async function listAddedSince(access: string, startHistoryId: string): Promise<string[] | null> {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  try {
    do {
      const u = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded" });
      if (pageToken) u.set("pageToken", pageToken);
      const r = await api<{ history?: { messagesAdded?: { message: { id: string } }[] }[]; nextPageToken?: string }>(access, `/history?${u}`);
      for (const h of r.history ?? []) for (const a of h.messagesAdded ?? []) ids.add(a.message.id);
      pageToken = r.nextPageToken;
    } while (pageToken);
  } catch (e) {
    if (e instanceof GmailApiError && e.status === 404) return null;
    throw e;
  }
  return Array.from(ids);
}

export const getMessage = (access: string, id: string) => api<GmailMessage>(access, `/messages/${id}?format=full`);

export function headerMap(m: GmailMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of m.payload?.headers ?? []) out[h.name.toLowerCase()] = h.value;
  return out;
}

/** The plain-text body: the first text/plain part, else tags stripped from text/html. */
export function plainText(m: GmailMessage): string {
  const found: { plain?: string; html?: string } = {};
  const walk = (p?: GmailPart) => {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data && found.plain === undefined) found.plain = Buffer.from(p.body.data, "base64url").toString("utf8");
    if (p.mimeType === "text/html" && p.body?.data && found.html === undefined) found.html = Buffer.from(p.body.data, "base64url").toString("utf8");
    (p.parts ?? []).forEach(walk);
  };
  walk(m.payload);
  if (found.plain !== undefined) return found.plain;
  return (found.html ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
