"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReplyType } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { Banner, Loading, Pill, StatusBanners, Title, btnCls, btnPrimary, fmtDate } from "./ui";

const TYPES: { t: ReplyType; label: string }[] = [
  { t: "positive", label: "Positive" }, { t: "neutral", label: "Neutral" }, { t: "no", label: "No" },
  { t: "stop", label: "Stop" }, { t: "bounce", label: "Bounce" }, { t: "auto", label: "Auto" },
];
const STALE_MS = 5 * 60 * 1000;

export function RepliesView() {
  const { state, act, reload } = usePhase1();
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState<"replies" | "enquiries">("replies");
  const [filter, setFilter] = useState<"all" | "unclassified">("all");
  const auto = useRef(false);

  const sync = useCallback(async () => {
    setSyncing(true);
    setNote(null);
    try {
      const res = await fetch("/phase1/api/gmail/sync", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setNote(j.error ?? "Sync failed");
      else {
        const parts = (j.results ?? []) as { address: string; result: { replies: number; bounces: number; enquiries: number } }[];
        const errs = (j.errors ?? []) as string[];
        const text = parts.map((r) => `${r.address}: ${r.result.replies} replies, ${r.result.bounces} bounces, ${r.result.enquiries} enquiries`).concat(errs.map(String));
        setNote(text.length ? text.join("; ") : "Nothing to sync: no Gmail mailbox is connected yet.");
            }
      await reload();
    } catch {
      setNote("Sync failed (network)");
    } finally {
      setSyncing(false);
    }
  }, [reload]);

  const usable = (state?.mailboxes ?? []).filter((m) => m.status === "connected");
  const lastSync = usable.map((m) => m.last_sync_at).filter(Boolean).sort().pop() ?? null;
  useEffect(() => {
    if (!state || auto.current || !state.gmail.configured || usable.length === 0) return;
    auto.current = true;
    if (!lastSync || Date.now() - new Date(lastSync).getTime() > STALE_MS) void sync();
  }, [state, usable.length, lastSync, sync]);

  if (!state) return <Loading />;
  const prospect = (id: string | null) => state.prospects.find((p) => p.id === id);
  const replies = [...state.replies].filter((r) => filter === "all" || r.reply_type === "unclassified").sort((a, b) => b.received_at.localeCompare(a.received_at));
  const open = state.enquiries.filter((e) => !e.handled_at).length;

  return (
    <div>
      <Title title="Replies" sub={lastSync ? `Last synced ${fmtDate(lastSync)}` : "Not synced yet"}>
        <button className={btnPrimary} disabled={syncing || !state.gmail.configured} onClick={sync}>{syncing ? "Syncing..." : "Sync now"}</button>
      </Title>
      <StatusBanners />
      {note && <div className="mb-3"><Banner>{note}</Banner></div>}
      <div className="mb-4 flex flex-wrap gap-2">
        <button className={`${btnCls} ${view === "replies" ? "border-arepo-ink" : ""}`} onClick={() => setView("replies")}>Replies ({state.replies.length})</button>
        <button className={`${btnCls} ${view === "enquiries" ? "border-arepo-ink" : ""}`} onClick={() => setView("enquiries")}>Enquiries ({open} open)</button>
        {view === "replies" && <button className={btnCls} onClick={() => setFilter(filter === "all" ? "unclassified" : "all")}>{filter === "all" ? "Show only unclassified" : "Show all"}</button>}
      </div>

      {view === "replies" && (
        <ul className="space-y-3">
          {replies.map((r) => {
            const p = prospect(r.prospect_id);
            return (
              <li key={r.id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-arepo-ink">{p?.name ?? r.from_address}</span>
                  <span className="text-arepo-muted">{r.from_address} · {fmtDate(r.received_at)}</span>
                  <Pill tone={r.reply_type === "positive" ? "pos" : r.reply_type === "unclassified" ? "warn" : r.reply_type === "stop" || r.reply_type === "bounce" ? "neg" : "neutral"}>{r.reply_type}</Pill>
                  {r.matched_by && <span className="text-xs text-arepo-muted">matched by {r.matched_by.replace("_", " ")}</span>}
                </div>
                {r.subject && <div className="mt-1 text-arepo-ink2">{r.subject}</div>}
                <p className="mt-1 whitespace-pre-wrap text-arepo-ink2">{r.snippet ?? r.body_text?.slice(0, 300)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TYPES.map((x) => (
                    <button key={x.t} className={`${btnCls} py-1 ${r.reply_type === x.t ? "border-arepo-ink" : ""}`} onClick={() => act("reply.classify", { id: r.id, type: x.t }).catch((e) => setNote(String(e.message ?? e)))}>{x.label}</button>
                  ))}
                </div>
                {r.reply_type === "stop" && <p className="mt-1 text-xs text-arepo-muted">Marked do not contact: no more emails will go to this business.</p>}
              </li>
            );
          })}
          {replies.length === 0 && <li className="text-sm text-arepo-muted">No replies yet. They appear after a sync once someone answers.</li>}
        </ul>
      )}

      {view === "enquiries" && (
        <ul className="space-y-3">
          {state.enquiries.map((e) => (
            <li key={e.id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-arepo-ink">{e.from_name ?? e.from_address}</span>
                <span className="text-arepo-muted">{e.from_address} · {fmtDate(e.received_at)}</span>
                {e.handled_at ? <Pill tone="pos">handled</Pill> : <Pill tone="warn">open</Pill>}
              </div>
              <div className="mt-1 text-arepo-ink2">{e.subject}</div>
              <p className="mt-1 text-arepo-muted">{e.snippet}</p>
              {!e.handled_at && <button className={`${btnCls} mt-2`} onClick={() => act("enquiry.handle", { id: e.id })}>Mark handled</button>}
            </li>
          ))}
          {state.enquiries.length === 0 && <li className="text-sm text-arepo-muted">No enquiries. Mail to the shared enquiries inbox that matches no prospect lands here.</li>}
        </ul>
      )}
    </div>
  );
}
