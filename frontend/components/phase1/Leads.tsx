"use client";

import { useState } from "react";
import { usePhase1 } from "./data";
import { Banner, btnCls, btnPrimary, inputCls } from "./ui";

/** "Generate new batch": writes a lead request TENET picks up. Shows the last 3 requests and where they got to. */
export function GenerateLeads() {
  const { state, act } = usePhase1();
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState("");
  const [count, setCount] = useState(20);
  const [area, setArea] = useState("London, anywhere");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const tracks = state?.programme.tracks ?? [];
  const requests = [...(state?.programme.leadRequests ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const line = (r: (typeof requests)[number]) =>
    r.status === "pending" ? `Requested ${when(r.created_at)}, waiting for TENET` : r.status === "working" ? `Requested ${when(r.created_at)}, TENET working on it` : r.status === "done" ? `${r.result_count ?? 0} new leads from the ${when(r.created_at)} request` : `Request from ${when(r.created_at)} failed`;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await act("lead.request", { track: track || tracks[0]?.key, count, area, note });
      setOpen(false);
      setNote("");
    } catch (er) {
      setMsg(er instanceof Error ? er.message : "Could not save");
    }
  }
  return (
    <div className="mt-3">
      {!open && <button className={btnCls} onClick={() => setOpen(true)} disabled={!tracks.length}>Generate new batch</button>}
      {open && (
        <form onSubmit={submit} className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="block"><span className="text-arepo-muted">Track</span>
            <select className={`${inputCls} mt-1 w-full`} value={track || tracks[0]?.key || ""} onChange={(e) => setTrack(e.target.value)}>
              {tracks.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select></label>
          <label className="block"><span className="text-arepo-muted">How many</span>
            <input className={`${inputCls} mt-1 w-full`} type="number" min={1} max={200} value={count} onChange={(e) => setCount(Number(e.target.value))} /></label>
          <label className="block"><span className="text-arepo-muted">Area</span>
            <input className={`${inputCls} mt-1 w-full`} value={area} onChange={(e) => setArea(e.target.value)} /></label>
          <label className="block"><span className="text-arepo-muted">Note (optional)</span>
            <input className={`${inputCls} mt-1 w-full`} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex items-center gap-2 sm:col-span-2"><button className={btnPrimary} type="submit" disabled={!tracks.length}>Request leads</button><button className={btnCls} type="button" onClick={() => setOpen(false)}>Cancel</button>{msg && <span className="text-red-700">{msg}</span>}</div>
        </form>
      )}
      {requests.length > 0 && <ul className="mt-3 space-y-1 text-sm text-arepo-muted">{requests.map((r) => <li key={r.id}>{line(r)}</li>)}</ul>}
    </div>
  );
}

/** Leads TENET found that still need a yes before they can be emailed. */
export function NewLeads() {
  const { state, act } = usePhase1();
  const [note, setNote] = useState<string | null>(null);
  const leads = (state?.programme.prospects ?? []).filter((p) => p.status === "new");
  if (!leads.length) return null;
  const decide = (ext_id: string, decision: "approve" | "skip") => act("lead.review", { ext_id, decision }).catch((e) => setNote(String(e.message ?? e)));
  return (
    <section aria-label="New leads" className="rounded-card border border-arepo-border bg-white p-5">
      <h2 className="font-display text-lg text-arepo-ink">New leads ({leads.length}) to review</h2>
      <p className="mt-1 text-sm text-arepo-muted">Only approved leads go into a phase.</p>
      {note && <div className="mt-2"><Banner tone="warn">{note}</Banner></div>}
      <ul className="mt-3 divide-y divide-arepo-border">
        {leads.map((p) => (
          <li key={p.ext_id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-arepo-ink">{p.company}</div>
              <div className="text-arepo-muted">{p.what_they_do ?? p.website ?? p.email}</div>
            </div>
            <button className={btnPrimary} onClick={() => decide(p.ext_id, "approve")}>Approve</button>
            <button className={btnCls} onClick={() => decide(p.ext_id, "skip")}>Skip</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
