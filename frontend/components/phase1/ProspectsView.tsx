"use client";

import { useMemo, useState } from "react";
import { sentBy } from "@/lib/phase1/programme";
import type { ProgrammeProspect } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { Loading, Pill, StatusBanners, Title, btnCls, inputCls } from "./ui";

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** "Limited company?" shown as Yes / No / Unclear / Not checked. */
export function ltdLabel(t: string | null | undefined): { text: string; tone: "pos" | "neg" | "warn" | "neutral" } {
  if (t === "ltd" || t === "llp" || t === "plc") return { text: "Yes", tone: "pos" };
  if (t === "unclear") return { text: "Unclear", tone: "warn" };
  if (t) return { text: "No", tone: "neg" };
  return { text: "Not checked", tone: "neutral" };
}

/** Consent given: a toggle with an optional date and note (set after a call or a visit). Saved on the prospect. */
function Consent({ p, consent, note }: { p: ProgrammeProspect; consent: boolean; note: string | null }) {
  const { act } = usePhase1();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}/.exec(note ?? "")?.[0] ?? "");
  const [text, setText] = useState((note ?? "").replace(/^\d{4}-\d{2}-\d{2}:?\s*/, ""));
  const [err, setErr] = useState<string | null>(null);
  if (!p.prospect_id) return <span className="text-arepo-muted">n/a</span>;
  const save = async (on: boolean) => {
    setErr(null);
    try {
      await act("prospect.update", { id: p.prospect_id, patch: { consent_recorded: on, consent_note: on ? [date, text.trim()].filter(Boolean).join(": ") || null : null } });
      if (!on) setOpen(false);
    } catch (e) { setErr(e instanceof Error ? e.message : "Could not save"); }
  };
  return (
    <div className="min-w-[11rem]">
      <label className="flex items-center gap-2"><input type="checkbox" checked={consent} onChange={(e) => { setOpen(e.target.checked); void save(e.target.checked); }} aria-label={`Consent given by ${p.company}`} /> {consent ? "Given" : "No"}</label>
      {consent && !open && note && <div className="max-w-[14rem] truncate text-xs text-arepo-muted" title={note}>{note}</div>}
      {consent && <button className="text-xs underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Date / note"}</button>}
      {open && (
        <div className="mt-1 space-y-1">
          <input type="date" className={`${inputCls} py-1`} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Consent date" />
          <input className={`${inputCls} py-1`} placeholder="Note (e.g. phoned, said yes)" value={text} onChange={(e) => setText(e.target.value)} aria-label="Consent note" />
          <button className={btnCls} onClick={() => save(true)}>Save</button>
        </div>
      )}
      {err && <div className="text-xs text-red-700">{err}</div>}
    </div>
  );
}

/** The pool the phases draw from, with the Limited company? column and the Consent given toggle. */
export function ProspectsView() {
  const { state } = usePhase1();
  const [ltd, setLtd] = useState("");
  const [q, setQ] = useState("");
  const [track, setTrack] = useState("");
  const rows = useMemo(() => {
    const all = state?.programme.prospects ?? [];
    const needle = q.trim().toLowerCase();
    return all
      .filter((p) => (!track || p.track_key === track) && (!ltd || ltdLabel(p.company_type).text === ltd) && (!needle || `${p.company} ${p.contact_name ?? ""} ${p.email ?? ""} ${p.segment ?? ""} ${p.what_they_do ?? ""}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.track_key.localeCompare(b.track_key) || (a.phase_id ?? "~").localeCompare(b.phase_id ?? "~") || a.company.localeCompare(b.company));
  }, [state, q, track, ltd]);
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
        <select className={`${inputCls} py-1.5`} value={ltd} onChange={(e) => setLtd(e.target.value)} aria-label="Limited company">
          <option value="">Limited company: any</option>
          {["Yes", "No", "Unclear", "Not checked"].map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-card border border-arepo-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted">
            <tr>{["Business", "Contact", "Email", "Track", "Phase", "Variant", "Limited company?", "Consent given", "Status", "Sent by"].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
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
                  <td className="px-3 py-2"><Pill tone={ltdLabel(p.company_type).tone}>{ltdLabel(p.company_type).text}</Pill>{p.walk_in && <div className="text-xs text-arepo-muted">walk-in / card only</div>}{p.ch_number && <div className="text-xs text-arepo-muted">CH {p.ch_number}</div>}</td>
                  <td className="px-3 py-2">{(() => { const c = state.prospects.find((x) => x.id === p.prospect_id); return <Consent p={p} consent={!!c?.consent_recorded} note={c?.consent_note ?? null} />; })()}</td>
                  <td className="px-3 py-2"><Pill tone={tone(p.status)}>{p.status.replace(/_/g, " ")}</Pill></td>
                  <td className="px-3 py-2">{by ? cap(by) : ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-arepo-muted">{state.programme.prospects.length === 0 ? "No prospects loaded yet." : "No prospects match."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
