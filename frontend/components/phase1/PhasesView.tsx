"use client";

import { useState } from "react";
import { computePhaseResult, prospectFacts, variantText } from "@/lib/phase1/programme";
import { usePhase1 } from "./data";
import { Banner, Loading, Pill, Title, btnPrimary } from "./ui";

const TONE = { planned: "neutral", active: "warn", judged: "pos" } as const;

export function PhasesView() {
  const { state, act } = usePhase1();
  const [note, setNote] = useState<string | null>(null);
  if (!state) return <Loading />;
  const { phases, tracks, prospects, messages } = state.programme;
  const facts = prospectFacts(prospects, messages, state.prospects, state.replies, state.events);
  const now = new Date();
  return (
    <div>
      <Title title="Phases" sub="One thing is tested at a time. The result is worked out on the judge day and you accept it." />
      {note && <div className="mb-3"><Banner tone="warn">{note}</Banner></div>}
      {phases.length === 0 && <p className="text-sm text-arepo-muted">No phases loaded yet.</p>}
      {tracks.map((t) => {
        const mine = phases.filter((p) => p.track_key === t.key).sort((a, b) => a.ord - b.ord);
        if (!mine.length) return null;
        return (
          <section key={t.key} className="mb-8">
            <h2 className="font-display text-lg text-arepo-ink">{t.name}</h2>
            <ol className="mt-3 space-y-3">
              {mine.map((p) => {
                const res = computePhaseResult(p, facts, now);
                const canAccept = p.status !== "judged" && res.due;
                return (
                  <li key={p.phase_id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-arepo-ink">{p.variable ?? p.phase_id}</span>
                      <Pill tone={TONE[p.status]}>{p.status}</Pill>
                      {p.judge_on && <span className="text-arepo-muted">judged {p.judge_on}</span>}
                    </div>
                    {p.hypothesis && <p className="mt-1 text-arepo-ink2">{p.hypothesis}</p>}
                    {p.variants && typeof p.variants === "object" && (
                      <ul className="mt-2 space-y-1 text-arepo-ink2">
                        {Object.keys(p.variants).map((k) => <li key={k}><span className="font-medium">{k}:</span> {variantText((p.variants as Record<string, unknown>)[k])}</li>)}
                      </ul>
                    )}
                    {p.status === "judged" ? (
                      <p className="mt-2 text-arepo-ink2">Winner: {p.winner === "none" || !p.winner ? "no clear winner" : p.winner}.</p>
                    ) : p.status === "active" || res.due ? (
                      <p className="mt-2 text-arepo-ink2">{res.summary}</p>
                    ) : null}
                    {canAccept && <button className={`${btnPrimary} mt-3`} onClick={() => act("phase.accept", { phase_id: p.phase_id }).catch((e) => setNote(String(e.message ?? e)))}>Accept result</button>}
                    {canAccept && res.next && <p className="mt-1 text-xs text-arepo-muted">Then: {res.next}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
