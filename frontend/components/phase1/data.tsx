"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Phase1State } from "@/lib/phase1/state";

interface Ctx {
  state: Phase1State | null;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  /** POST one write to /phase1/api/act; reloads on success. Throws Error(message) on failure. */
  act: <T = Record<string, unknown>>(action: string, body?: Record<string, unknown>, opts?: { reload?: boolean }) => Promise<T>;
}

const C = createContext<Ctx | null>(null);

export function Phase1Provider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Phase1State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);

  const reload = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch("/phase1/api/state", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) throw new Error(j?.error ?? "Could not load");
      setState(j as Phase1State);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = useCallback(
    async <T,>(action: string, body: Record<string, unknown> = {}, opts: { reload?: boolean } = {}): Promise<T> => {
      const res = await fetch("/phase1/api/act", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "That did not work");
      if (opts.reload !== false) await reload();
      return j as T;
    },
    [reload],
  );

  return <C.Provider value={{ state, error, loading, reload, act }}>{children}</C.Provider>;
}

export function usePhase1(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("usePhase1 outside Phase1Provider");
  return c;
}
