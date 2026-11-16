/**
 * Server-side data and session access for /phase1. Everything here is lazy: no client is created at
 * import or build time, so `next build` works with no Supabase variables set. Server-only: never
 * import this from a client component.
 *
 * Interface for the other packages (WP4 to WP6):
 *   - `requireUser()`            session + allowlist check; throws Phase1Error (use `errorResponse`).
 *   - `getDb()`                  a `Phase1Db`: typed select/insert/update/upsert/remove on the Phase 1
 *                                tables. Service-role Supabase in real runs, an in-memory store when
 *                                PHASE1_TEST_MODE=1. Always call `requireUser()` first and set
 *                                `owner_id` from `user.personId`, never from the request body.
 *   - `seedTestStore(table, rows)` / `resetTestStore()`  fill or clear the in-memory store (test mode).
 *   - `getSession()`             non-throwing session state (the shell uses it).
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  TEST_COOKIE,
  allowedEmails,
  initialsFor,
  isAllowed,
  isTestMode,
  supabaseEnv,
} from "./allowlist";
import type { Insert, Phase1User, Row, TableName } from "./types";

// ---------------------------------------------------------------- errors

export class Phase1Error extends Error {
  constructor(
    public status: 401 | 403 | 500 | 503,
    message: string,
  ) {
    super(message);
    this.name = "Phase1Error";
  }
}

/** JSON response for a route handler's catch block: 401, 403, 503 or a generic 500. */
export function errorResponse(e: unknown): Response {
  if (e instanceof Phase1Error) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  return Response.json({ error: "Server error" }, { status: 500 });
}

// ---------------------------------------------------------------- Db interface

export interface SelectQuery<T extends TableName> {
  eq?: Partial<Row<T>>;
  order?: { column: keyof Row<T> & string; ascending?: boolean };
  limit?: number;
}

export interface Phase1Db {
  select<T extends TableName>(table: T, q?: SelectQuery<T>): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, rows: Insert<T> | Insert<T>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, match: Partial<Row<T>>, patch: Insert<T>): Promise<Row<T>[]>;
  /** `onConflict` is a comma-separated column list, e.g. "name,area" or "kind,code". */
  upsert<T extends TableName>(table: T, rows: Insert<T> | Insert<T>[], onConflict: string): Promise<Row<T>[]>;
  remove<T extends TableName>(table: T, match: Partial<Row<T>>): Promise<number>;
}

// ---------------------------------------------------------------- in-memory store (test mode)

type AnyRow = Record<string, unknown>;
type Mem = Map<TableName, AnyRow[]>;

const G = globalThis as unknown as { __phase1Mem?: Mem };

function mem(): Mem {
  if (!G.__phase1Mem) {
    G.__phase1Mem = new Map();
    seedPeople(G.__phase1Mem);
  }
  return G.__phase1Mem;
}

function seedPeople(m: Mem) {
  const emails = new Set(allowedEmails());
  const u = process.env.PHASE1_TEST_USER?.trim().toLowerCase();
  if (u) emails.add(u);
  m.set(
    "people",
    Array.from(emails).map((email) => ({
      id: crypto.randomUUID(),
      email,
      name: null,
      initials: initialsFor(email),
      colour: null,
      created_at: new Date().toISOString(),
    })),
  );
}

/** Replace a table's rows in the in-memory store (test mode). Rows get an id and created_at if missing. */
export function seedTestStore<T extends TableName>(table: T, rows: Insert<T>[]): void {
  const now = new Date().toISOString();
  mem().set(
    table,
    rows.map((r) => ({ id: crypto.randomUUID(), created_at: now, ...(r as AnyRow) })),
  );
}

/** Clear the in-memory store back to just the `people` rows. */
export function resetTestStore(): void {
  G.__phase1Mem = undefined;
}

function matches(row: AnyRow, eq: AnyRow | undefined): boolean {
  if (!eq) return true;
  return Object.entries(eq).every(([k, v]) => row[k] === v);
}

function withDefaults(table: TableName, r: AnyRow): AnyRow {
  const now = new Date().toISOString();
  const row: AnyRow = { id: crypto.randomUUID(), created_at: now, ...r };
  if (table === "prospects") {
    row.status ??= "prospect";
    row.company_type ??= "unknown";
    row.consent_recorded ??= false;
    row.email_found ??= false;
    row.status_changed_at ??= now;
    row.updated_at ??= now;
    row.legal_ok = row.company_type === "ltd" || row.company_type === "llp" || row.consent_recorded === true;
  }
  if (table === "variants") row.status ??= "active";
  if (table === "outreach_emails") {
    row.status ??= "composed";
    row.composed_at ??= now;
  }
  if (table === "replies") row.reply_type ??= "unclassified";
  if (table === "events") row.at ??= now;
  if (table === "mailboxes") {
    row.provider ??= "gmail";
    row.kind ??= "personal";
    row.status ??= "connected";
    row.send_as_verified ??= false;
  }
  if (table === "plan_targets") row.cumulative ??= true;
  if (table === "checklist") row.sort_order ??= 0;
  return row;
}

function recomputeLegal(table: TableName, row: AnyRow) {
  if (table === "prospects") {
    row.legal_ok = row.company_type === "ltd" || row.company_type === "llp" || row.consent_recorded === true;
  }
}

function memoryDb(): Phase1Db {
  const rowsOf = (t: TableName) => {
    const m = mem();
    if (!m.has(t)) m.set(t, []);
    return m.get(t)!;
  };
  const copy = <T>(r: AnyRow) => ({ ...r }) as T;
  return {
    async select(table, q) {
      let out = rowsOf(table).filter((r) => matches(r, q?.eq as AnyRow | undefined));
      if (q?.order) {
        const { column, ascending = true } = q.order;
        out = [...out].sort((a, b) => {
          const x = a[column] as string | number | null;
          const y = b[column] as string | number | null;
          if (x === y) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          return (x < y ? -1 : 1) * (ascending ? 1 : -1);
        });
      }
      if (q?.limit != null) out = out.slice(0, q.limit);
      return out.map((r) => copy(r)) as never;
    },
    async insert(table, rows) {
      const list = (Array.isArray(rows) ? rows : [rows]) as AnyRow[];
      const made = list.map((r) => withDefaults(table, r));
      rowsOf(table).push(...made);
      return made.map((r) => copy(r)) as never;
    },
    async update(table, match, patch) {
      const hit = rowsOf(table).filter((r) => matches(r, match as AnyRow));
      for (const r of hit) {
        Object.assign(r, patch);
        if (table === "prospects") r.updated_at = new Date().toISOString();
        recomputeLegal(table, r);
      }
      return hit.map((r) => copy(r)) as never;
    },
    async upsert(table, rows, onConflict) {
      const cols = onConflict.split(",").map((c) => c.trim());
      const list = (Array.isArray(rows) ? rows : [rows]) as AnyRow[];
      const store = rowsOf(table);
      const out: AnyRow[] = [];
      for (const r of list) {
        const found = store.find((s) => cols.every((c) => s[c] === r[c]));
        if (found) {
          Object.assign(found, r);
          recomputeLegal(table, found);
          out.push(found);
        } else {
          const made = withDefaults(table, r);
          store.push(made);
          out.push(made);
        }
      }
      return out.map((r) => copy(r)) as never;
    },
    async remove(table, match) {
      const store = rowsOf(table);
      const keep = store.filter((r) => !matches(r, match as AnyRow));
      const n = store.length - keep.length;
      mem().set(table, keep);
      return n;
    },
  };
}

// ---------------------------------------------------------------- Supabase clients (lazy)

function notConfigured(): never {
  throw new Phase1Error(503, "Phase 1 is not configured");
}

/** Cookie-bound client for the signed-in browser session (anon key). Call per request. */
export function createSessionClient(): SupabaseClient {
  const env = supabaseEnv();
  if (!env) notConfigured();
  const store = cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the cookies instead.
        }
      },
    },
  }) as unknown as SupabaseClient;
}

let service: SupabaseClient | null = null;

/** Service-role client. Server only; bypasses RLS, so call it only after `requireUser()`. */
export function createServiceClient(): SupabaseClient {
  if (service) return service;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) notConfigured();
  service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return service;
}

function supabaseDb(): Phase1Db {
  const fail = (e: { message: string } | null) => {
    if (e) {
      console.error("phase1 db error:", e.message);
      throw new Phase1Error(500, "Database error");
    }
  };
  return {
    async select(table, q) {
      let query = createServiceClient().from(table).select("*");
      for (const [k, v] of Object.entries((q?.eq ?? {}) as AnyRow)) query = query.eq(k, v as never);
      if (q?.order) query = query.order(q.order.column, { ascending: q.order.ascending ?? true });
      if (q?.limit != null) query = query.limit(q.limit);
      const { data, error } = await query;
      fail(error);
      return (data ?? []) as never;
    },
    async insert(table, rows) {
      const { data, error } = await createServiceClient().from(table).insert(rows as never).select();
      fail(error);
      return (data ?? []) as never;
    },
    async update(table, match, patch) {
      let query = createServiceClient().from(table).update(patch as never);
      for (const [k, v] of Object.entries(match as AnyRow)) query = query.eq(k, v as never);
      const { data, error } = await query.select();
      fail(error);
      return (data ?? []) as never;
    },
    async upsert(table, rows, onConflict) {
      const { data, error } = await createServiceClient()
        .from(table)
        .upsert(rows as never, { onConflict })
        .select();
      fail(error);
      return (data ?? []) as never;
    },
    async remove(table, match) {
      let query = createServiceClient().from(table).delete();
      for (const [k, v] of Object.entries(match as AnyRow)) query = query.eq(k, v as never);
      const { data, error } = await query.select();
      fail(error);
      return (data ?? []).length;
    },
  };
}

let memoryInstance: Phase1Db | null = null;
let supabaseInstance: Phase1Db | null = null;

/** The data layer: in-memory in test mode, service-role Supabase otherwise. */
export function getDb(): Phase1Db {
  if (isTestMode()) return (memoryInstance ??= memoryDb());
  return (supabaseInstance ??= supabaseDb());
}

// ---------------------------------------------------------------- session

export type Session =
  | { state: "ok"; user: Phase1User }
  | { state: "signed_out" }
  | { state: "not_invited"; email: string }
  | { state: "unconfigured" };

async function resolvePerson(email: string): Promise<string | null> {
  try {
    const db = getDb();
    let rows = await db.select("people", { eq: { email }, limit: 1 });
    if (rows.length === 0) {
      try {
        await db.insert("people", { email, initials: initialsFor(email) });
      } catch {
        // A concurrent request created it; read again below.
      }
      rows = await db.select("people", { eq: { email }, limit: 1 });
    }
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Non-throwing session state. Cached for the duration of one request. */
export const getSession = cache(async (): Promise<Session> => {
  let email: string | null = null;

  if (isTestMode()) {
    email = cookies().get(TEST_COOKIE)?.value?.trim().toLowerCase() || null;
  } else {
    if (!supabaseEnv()) return { state: "unconfigured" };
    const { data } = await createSessionClient().auth.getUser();
    email = data.user?.email?.toLowerCase() ?? null;
  }

  if (!email) return { state: "signed_out" };
  if (!isAllowed(email, allowedEmails())) return { state: "not_invited", email };
  return {
    state: "ok",
    user: { email, initials: initialsFor(email), personId: await resolvePerson(email) },
  };
});

/**
 * The signed-in, allowlisted user, or a thrown Phase1Error: 503 not configured, 401 signed out,
 * 403 not invited. Route handlers call this first and `return errorResponse(e)` from the catch.
 */
export async function requireUser(): Promise<Phase1User> {
  const s = await getSession();
  switch (s.state) {
    case "ok":
      return s.user;
    case "unconfigured":
      return notConfigured();
    case "not_invited":
      throw new Phase1Error(403, "Not invited");
    default:
      throw new Phase1Error(401, "Not signed in");
  }
}
