import { describe, expect, it, vi } from "vitest";
import { copy } from "@/content/agency/copy";
import { fetchProfileRows, mergeProfiles, parseProfileInput } from "./profiles";

const base = copy.who.people;

describe("mergeProfiles", () => {
  it("returns the copy.ts values with no rows", () => {
    expect(mergeProfiles(base, [])).toEqual(base);
    expect(mergeProfiles(base, null)).toEqual(base);
  });
  it("overrides every field", () => {
    const [d] = mergeProfiles(base, [
      { slug: "dayyan", name: "D S", role: "R", bio: "B", proof: "P", email: "a@b.co", calendly: "https://c.example/x", photo_url: "https://p.example/a.jpg" },
    ]);
    expect(d).toMatchObject({ name: "D S", role: "R", bio: "B", proof: "P", email: "a@b.co", calendly: "https://c.example/x", photo: "https://p.example/a.jpg", initials: "DS" });
  });
  it("overrides partially and only the matching person", () => {
    const out = mergeProfiles(base, [{ slug: "jack", bio: "New bio" }]);
    expect(out[0]).toEqual(base[0]);
    expect(out[1]).toEqual({ ...base[1], bio: "New bio" });
  });
  it("ignores empty, blank and null values", () => {
    const out = mergeProfiles(base, [{ slug: "dayyan", name: "", role: "   ", bio: null, calendly: "" }]);
    expect(out[0]).toEqual(base[0]);
  });
});

describe("fetchProfileRows", () => {
  it("is empty with no env", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(await fetchProfileRows()).toEqual([]);
    vi.unstubAllEnvs();
  });
  it("is empty when Supabase is down", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await fetchProfileRows()).toEqual([]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await fetchProfileRows()).toEqual([]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("returns rows on success", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.example");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ slug: "jack", bio: "x" }] }));
    expect(await fetchProfileRows()).toEqual([{ slug: "jack", bio: "x" }]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe("parseProfileInput", () => {
  it("accepts a good body and trims", () => {
    const r = parseProfileInput({ slug: "jack", name: " J ", photo_url: "https://a.example/p.jpg" });
    expect(r?.slug).toBe("jack");
    expect(r?.values.name).toBe("J");
    expect(r?.values.bio).toBe("");
  });
  it("rejects bad slug, non-strings, long text and unsafe URLs", () => {
    expect(parseProfileInput({ slug: "x" })).toBeNull();
    expect(parseProfileInput({ slug: "jack", name: 5 })).toBeNull();
    expect(parseProfileInput({ slug: "jack", bio: "a".repeat(2001) })).toBeNull();
    expect(parseProfileInput({ slug: "jack", photo_url: "javascript:alert(1)" })).toBeNull();
    expect(parseProfileInput({ slug: "jack", calendly: "javascript:x" })).toBeNull();
    expect(parseProfileInput(null)).toBeNull();
  });
});
