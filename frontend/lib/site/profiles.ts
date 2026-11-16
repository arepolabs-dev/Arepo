/**
 * Founder profiles on the public page: saved edits (table `site_profiles`) merged over the
 * hard-coded copy in content/agency/copy.ts. Pure merge plus a fetch that never throws.
 */
import { copy } from "@/content/agency/copy";

export const PROFILE_SLUGS = ["dayyan", "jack"] as const;
export type ProfileSlug = (typeof PROFILE_SLUGS)[number];

export const PROFILE_FIELDS = ["name", "role", "bio", "proof", "email", "calendly", "photo_url"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileRow = Partial<Record<ProfileField, string | null>> & { slug?: string };

export interface Person {
  name: string;
  initials: string;
  role: string;
  bio: string;
  proof: string;
  email: string;
  calendly: string;
  photo: string;
}

const CLEAN = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Override each person field by field; empty, blank or missing saved values keep the copy.ts value. */
export function mergeProfiles(base: readonly Person[], rows: readonly ProfileRow[] | null | undefined): Person[] {
  const bySlug = new Map((rows ?? []).map((r) => [r.slug, r]));
  return base.map((p, i) => {
    const r = bySlug.get(PROFILE_SLUGS[i]);
    if (!r) return { ...p };
    return {
      ...p,
      name: CLEAN(r.name) ?? p.name,
      role: CLEAN(r.role) ?? p.role,
      bio: CLEAN(r.bio) ?? p.bio,
      proof: CLEAN(r.proof) ?? p.proof,
      email: CLEAN(r.email) ?? p.email,
      calendly: CLEAN(r.calendly) ?? p.calendly,
      photo: CLEAN(r.photo_url) ?? p.photo,
    };
  });
}

/** Saved profiles with the anon key, cached 60 s and revalidated on save. [] on any failure. */
export async function fetchProfileRows(): Promise<ProfileRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/site_profiles?select=*`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60, tags: ["site-profiles"] },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as ProfileRow[]) : [];
  } catch {
    return [];
  }
}

export async function getPeople(): Promise<Person[]> {
  return mergeProfiles(copy.who.people, await fetchProfileRows());
}

/** Validate a save body: known slug, string fields only, sensible lengths. */
export function parseProfileInput(body: unknown): { slug: ProfileSlug; values: Record<ProfileField, string> } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!PROFILE_SLUGS.includes(b.slug as ProfileSlug)) return null;
  const values = {} as Record<ProfileField, string>;
  for (const f of PROFILE_FIELDS) {
    const v = b[f] ?? "";
    if (typeof v !== "string" || v.length > 2000) return null;
    values[f] = v.trim();
  }
  if (values.photo_url && !/^https:\/\//.test(values.photo_url)) return null;
  if (values.calendly && !/^https?:\/\//.test(values.calendly)) return null;
  return { slug: b.slug as ProfileSlug, values };
}
