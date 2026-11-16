"use client";

import { useState } from "react";
import Link from "next/link";
import { STAGE_LABELS } from "@/lib/phase1/pipeline";
import { PIPELINE_STAGES, type ProspectStatus } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { Banner, Loading, Pill, StatusBanners, Title, btnCls, inputCls } from "./ui";

export function PipelineView() {
  const { state, act } = usePhase1();
  const [mine, setMine] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  if (!state) return <Loading />;
  const people = state.people;
  const first = (id: string | null) => { const p = people.find((x) => x.id === id); return p ? (p.name ?? p.email).split(" ")[0] : ""; };
  const prospects = state.prospects.filter((p) => !mine || p.owner_id === state.me.personId);
  const dnc = prospects.filter((p) => p.status === "do_not_contact");

  async function move(id: string, to: ProspectStatus) {
    try {
      await act("prospect.move", { id, to });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not move");
    }
  }

  return (
    <div>
      <Title title="Pipeline" sub={`${prospects.length} businesses`}>
        <label className="flex items-center gap-2 text-sm text-arepo-ink2"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine only</label>
        <Link className={btnCls} href="/phase1/prospects">Open the list</Link>
      </Title>
      <StatusBanners gmail={false} />
      {msg && <div className="mb-3"><Banner tone="bad">{msg}</Banner></div>}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {PIPELINE_STAGES.map((st) => {
          const col = prospects.filter((p) => p.status === st);
          const shown = st === "prospect" ? col.slice(0, 60) : col;
          return (
            <section key={st} className="w-64 shrink-0 rounded-card border border-arepo-border bg-arepo-surface2 p-2"
              onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) void move(drag, st); setDrag(null); }} aria-label={STAGE_LABELS[st]}>
              <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-medium text-arepo-ink">{STAGE_LABELS[st]} <Pill>{col.length}</Pill></h2>
              <ul className="space-y-2">
                {shown.map((p) => (
                  <li key={p.id} draggable onDragStart={() => setDrag(p.id)} className="rounded-control border border-arepo-border bg-white p-2 text-sm">
                    <div className="font-medium text-arepo-ink">{p.name}</div>
                    <div className="text-xs text-arepo-muted">{[p.tier && `Tier ${p.tier}`, first(p.owner_id), p.area].filter(Boolean).join(" · ")}</div>
                    <select aria-label={`Move ${p.name}`} className={`${inputCls} mt-2 w-full py-1 text-xs`} value={p.status} onChange={(e) => move(p.id, e.target.value as ProspectStatus)}>
                      {PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                      <option value="do_not_contact">{STAGE_LABELS.do_not_contact}</option>
                    </select>
                  </li>
                ))}
                {col.length > shown.length && <li className="px-1 text-xs text-arepo-muted">and {col.length - shown.length} more (see the list)</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-arepo-muted">Do not contact: {dnc.length}{dnc.length ? ` (${dnc.slice(0, 6).map((p) => p.name).join(", ")}${dnc.length > 6 ? ", ..." : ""})` : ""}</p>
    </div>
  );
}
