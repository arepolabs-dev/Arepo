"use client";

import { useState } from "react";
import { prospectFacts, tally } from "@/lib/phase1/programme";
import { usePhase1 } from "./data";

const BY = [["variant", "Variant"], ["phase_id", "Phase"], ["track_key", "Track"], ["segment", "Segment"]] as const;

/** Programme results by variant, phase, track or segment. Quiet: one small table. */
export function ProgrammeMetrics() {
  const { state } = usePhase1();
  const [by, setBy] = useState<(typeof BY)[number][0]>("variant");
  if (!state || !state.programme.prospects.length) return null;
  const rows = tally(prospectFacts(state.programme.prospects, state.programme.messages, state.prospects, state.replies, state.events), by);
  const pct = (n: number | null) => (n == null ? "-" : `${Math.round(n * 100)}%`);
  return (
    <section className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-arepo-ink">Programme results</h2>
        <div className="flex gap-1 text-sm">{BY.map(([k, l]) => <button key={k} onClick={() => setBy(k)} className={`rounded-control px-2 py-1 ${by === k ? "bg-arepo-surface2 text-arepo-ink" : "text-arepo-muted"}`}>{l}</button>)}</div>
      </div>
      <div className="mt-3 overflow-x-auto rounded-card border border-arepo-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="text-arepo-muted"><tr><th className="p-3">{BY.find((b) => b[0] === by)![1]}</th><th className="p-3">Sent</th><th className="p-3">Replies</th><th className="p-3">Reply rate</th><th className="p-3">Positive</th><th className="p-3">Calls</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.key} className="border-t border-arepo-border"><td className="p-3 text-arepo-ink">{r.key}</td><td className="p-3">{r.sent}</td><td className="p-3">{r.replied}</td><td className="p-3">{pct(r.replyRate)}</td><td className="p-3">{r.positive}</td><td className="p-3">{r.calls}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
