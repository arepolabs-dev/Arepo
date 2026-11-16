"use client";

import type { ReactNode } from "react";
import { usePhase1 } from "./data";

export const inputCls = "rounded-control border border-arepo-border bg-white px-3 py-2 text-sm text-arepo-ink focus:outline-none focus:ring-1 focus:ring-arepo-ink2";
export const btnCls = "rounded-control border border-arepo-border bg-white px-3 py-2 text-sm text-arepo-ink hover:bg-arepo-surface2 disabled:opacity-50";
export const btnPrimary = "rounded-control bg-arepo-ink px-4 py-2 text-sm font-medium text-white hover:bg-arepo-ink2 disabled:opacity-50";

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "bad"; children: ReactNode }) {
  const cls = tone === "bad" ? "border-arepo-accentBorder bg-arepo-accentTint text-arepo-accentActive" : tone === "warn" ? "border-arepo-warn/40 bg-[#FBF3E4] text-arepo-warnText" : "border-arepo-border bg-arepo-surface2 text-arepo-ink2";
  return <div role="status" className={`rounded-control border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "pos" | "neg" | "warn" }) {
  const cls = tone === "pos" ? "bg-[#E4F2EB] text-arepo-pos" : tone === "neg" ? "bg-arepo-accentTint text-arepo-neg" : tone === "warn" ? "bg-[#FBF3E4] text-arepo-warnText" : "bg-arepo-surface2 text-arepo-ink2";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function Title({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl text-arepo-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-arepo-muted">{sub}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Notes that apply on every tab: the database not ready, Gmail not connected. */
export function StatusBanners({ gmail = true }: { gmail?: boolean }) {
  const { state } = usePhase1();
  if (!state) return null;
  const needs = state.mailboxes.filter((m) => m.status === "needs_reconnect");
  return (
    <div className="mb-4 space-y-2">
      {!state.dbOk && <Banner tone="warn">{state.dbNote}</Banner>}
      {state.testMode && <Banner>Demo mode: data is kept in memory and resets when the server restarts. Nothing is sent.</Banner>}
      {gmail && !state.gmail.configured && (
        <Banner>
          Gmail is not connected yet ({state.gmail.missing.join(", ")} not set). Everything else works; to send, use &ldquo;Open in mail app&rdquo; and &ldquo;Mark as sent&rdquo;.
        </Banner>
      )}
      {gmail && needs.map((m) => (
        <Banner key={m.id} tone="bad">
          Reconnect Gmail for {m.address}: Google asked to sign in again (this happens every 7 days while the app is in testing).{" "}
          <a className="underline" href={`/phase1/api/gmail/connect?kind=${m.kind}`}>Reconnect</a>
        </Banner>
      ))}
    </div>
  );
}

export function Loading() {
  const { error, loading } = usePhase1();
  if (error) return <Banner tone="bad">{error}</Banner>;
  return loading ? <p className="text-sm text-arepo-muted">Loading...</p> : null;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
