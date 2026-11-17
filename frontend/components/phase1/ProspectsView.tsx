"use client";

import { useMemo, useState } from "react";
import { sentBy } from "@/lib/phase1/programme";
import { usePhase1 } from "./data";
import { Loading, Pill, StatusBanners, Title, inputCls } from "./ui";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The pool the phases draw from. Read only: TENET loads it, the phases use it. */
export function ProspectsView() {
  const { state } = usePhase1();
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const rows = useMemo(() => {
    const all = state?.programme.prospects ?? [];
    const needle = q.trim().toLowerCase();
    return all
      .filter((p) => (!track || p.track_key === track) && (!needle || `${p.company} ${p.contact_name ?? ""} ${p.email ?? ""} ${p.segment ?? ""} ${p.what_they_do ?? ""}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.track_key.localeCompare(b.track_key) || (a.phase_id ?? "~").localeCompare(b.phase_id ?? "~") || a.company.localeCompare(b.company));
  }, [state, q, track]);
  if (!state) return <Loading />;
  const { tracks, messages } = state.programme;
  const trackName = (k: string) => tracks.find((t) => t.key === k)?.name ?? k;
  const tone = (s: string) => (s === "replied" || s === "call_booked" || s === "won" ? "pos" : s === "do_not_contact" || s === "bounced" || s === "lost" ? "neg" : s === "new" ? "warn" : "neutral") as "pos" | "neg" | "warn" | "neutral";

  return (
    <div>
      <Title title="Prospects" sub={`${rows.length} of ${state.programme.prospects.length}. The phases draw from this list; TENET keeps it topped up.`} />
      <StatusBanners gmail={false} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className={`${inputCls} w-56 py-1.5`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className={`${inputCls} py-1.5`} value={track} onChange={(e) => setTrack(e.target.value)} aria-label="Track">
          <option value="">All tracks</option>
          {tracks.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-card border border-arepo-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted">
            <tr>{["Business", "Contact", "Email", "Track", "Phase", "Variant", "Status", "Sent by"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const by = sentBy(p, messages, tracks);
              return (
                <tr key={p.ext_id} className="border-t border-arepo-border align-top">
                  <td className="px-3 py-2 text-arepo-ink">
                    {p.website ? <a className="underline" target="_blank" rel="noreferrer" href={/^https?:/.test(p.website) ? p.website : `https://${p.website}`}>{p.company}</a> : p.company}
                    {p.what_they_do && <div className="max-w-[18rem] truncate text-xs text-arepo-muted" title={p.what_they_do}>{p.what_they_do}</div>}
                  </td>
                  <td className="px-3 py-2">{p.contact_name ?? ""}</td>
                  <td className="px-3 py-2">{p.email ?? <span className="text-arepo-muted">none</span>}</td>
                  <td className="px-3 py-2">{trackName(p.track_key)}</td>
                  <td className="px-3 py-2">{p.phase_id ?? <span className="text-arepo-muted">unassigned</span>}</td>
                  <td className="px-3 py-2">{p.variant ?? ""}</td>
                  <td className="px-3 py-2"><Pill tone={tone(p.status)}>{p.status.replace(/_/g, " ")}</Pill></td>
                  <td className="px-3 py-2">{by ? cap(by) : ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="px-3 py-6 text-center text-arepo-muted">{state.programme.prospects.length === 0 ? "No prospects loaded yet." : "No prospects match."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
