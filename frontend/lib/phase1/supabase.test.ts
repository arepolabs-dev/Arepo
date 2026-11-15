import { beforeEach, describe, expect, it, vi } from "vitest";

// React.cache only exists under the Next server build; a pass-through is enough here.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(f: T) => f }));

import { getDb, resetTestStore, seedTestStore } from "./supabase";

process.env.PHASE1_TEST_MODE = "1";
process.env.PHASE1_ALLOWED_EMAILS = "a@example.com,b@example.com";

describe("in-memory store (test mode)", () => {
  beforeEach(() => resetTestStore());

  it("seeds people from the allowlist", async () => {
    const people = await getDb().select("people", { order: { column: "email" } });
    expect(people.map((p) => p.email)).toEqual(["a@example.com", "b@example.com"]);
  });

  it("insert, select, update, upsert, remove", async () => {
    const db = getDb();
    const [p] = await db.insert("prospects", { name: "Acme", area: "W3-W7", company_type: "sole_trader" });
    expect(p!.status).toBe("prospect");
    expect(p!.legal_ok).toBe(false);
    await db.update("prospects", { id: p!.id }, { consent_recorded: true });
    expect((await db.select("prospects", { eq: { id: p!.id } }))[0]!.legal_ok).toBe(true);
    await db.upsert("prospects", { name: "Acme", area: "W3-W7", company_type: "ltd" }, "name,area");
    expect(await db.select("prospects")).toHaveLength(1);
    expect(await db.remove("prospects", { id: p!.id })).toBe(1);
    expect(await db.select("prospects")).toHaveLength(0);
  });

  it("seedTestStore replaces a table", async () => {
    seedTestStore("variants", [{ kind: "subject", code: "A", text: "Hi" }]);
    expect(await getDb().select("variants")).toHaveLength(1);
  });
});
