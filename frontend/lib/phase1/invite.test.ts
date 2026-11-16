import { describe, expect, it } from "vitest";
import {
  INVITE_TTL_MS,
  claimInvite,
  createInvite,
  peekInvite,
  sha256Hex,
  type InviteRow,
  type InviteStore,
} from "./invite";
import { rpConfig } from "./passkey";

const list = ["a@example.com", "b@example.com"];
const NOW = 1_800_000_000_000;

function memoryStore() {
  const rows = new Map<string, InviteRow>();
  const store: InviteStore = {
    async insert(r) {
      rows.set(r.token_hash, { ...r, used_at: null });
    },
    async find(h) {
      return rows.get(h) ?? null;
    },
    async claim(h, nowIso) {
      const r = rows.get(h);
      if (!r || r.used_at || Date.parse(r.expires_at) <= Date.parse(nowIso)) return null;
      r.used_at = nowIso;
      return r.email;
    },
    async release(h) {
      const r = rows.get(h);
      if (r) r.used_at = null;
    },
  };
  return { rows, store };
}

describe("invites", () => {
  it("refuses an email that is not allowlisted and stores nothing", async () => {
    const { rows, store } = memoryStore();
    await expect(createInvite(store, "evil@example.com", list, NOW)).rejects.toThrow(/PHASE1_ALLOWED_EMAILS/);
    expect(rows.size).toBe(0);
  });

  it("stores only the sha256 of the token, expiring in 7 days", async () => {
    const { rows, store } = memoryStore();
    const token = await createInvite(store, "A@Example.com", list, NOW);
    expect(token.length).toBeGreaterThanOrEqual(40);
    const [row] = Array.from(rows.values());
    expect(row!.token_hash).toBe(await sha256Hex(token));
    expect(row!.token_hash).not.toContain(token);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row!.email).toBe("a@example.com");
    expect(Date.parse(row!.expires_at) - NOW).toBe(INVITE_TTL_MS);
  });

  it("is single use", async () => {
    const { store } = memoryStore();
    const token = await createInvite(store, "a@example.com", list, NOW);
    expect(await peekInvite(store, token, list, NOW + 1000)).toBe("a@example.com");
    expect(await claimInvite(store, token, list, NOW + 1000)).toBe("a@example.com");
    expect(await claimInvite(store, token, list, NOW + 2000)).toBeNull();
    expect(await peekInvite(store, token, list, NOW + 2000)).toBeNull();
  });

  it("expires after 7 days", async () => {
    const { store } = memoryStore();
    const token = await createInvite(store, "a@example.com", list, NOW);
    expect(await peekInvite(store, token, list, NOW + INVITE_TTL_MS - 1)).toBe("a@example.com");
    expect(await peekInvite(store, token, list, NOW + INVITE_TTL_MS)).toBeNull();
    expect(await claimInvite(store, token, list, NOW + INVITE_TTL_MS)).toBeNull();
  });

  it("rejects unknown tokens and an address removed from the allowlist since", async () => {
    const { rows, store } = memoryStore();
    expect(await claimInvite(store, "nope", list, NOW)).toBeNull();
    expect(await peekInvite(store, "", list, NOW)).toBeNull();
    const token = await createInvite(store, "a@example.com", list, NOW);
    expect(await peekInvite(store, token, ["b@example.com"], NOW)).toBeNull();
    expect(await claimInvite(store, token, ["b@example.com"], NOW)).toBeNull();
    // A refused claim releases the invite rather than burning it.
    expect(Array.from(rows.values())[0]!.used_at).toBeNull();
  });
});

describe("relying party config", () => {
  const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
  it("reads PHASE1_RP_ID and comma-separated PHASE1_ORIGINS", () => {
    expect(rpConfig(env({}))).toBeNull();
    expect(rpConfig(env({ PHASE1_RP_ID: "arepolabs.com" }))).toBeNull();
    expect(
      rpConfig(env({ PHASE1_RP_ID: "arepolabs.com", PHASE1_ORIGINS: "https://www.arepolabs.com/, https://arepolabs.com" })),
    ).toEqual({ rpID: "arepolabs.com", origins: ["https://www.arepolabs.com", "https://arepolabs.com"] });
  });
});
