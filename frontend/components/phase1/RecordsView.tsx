"use client";

import { useState } from "react";
import { usePhase1 } from "./data";
import { Banner, Loading, Title, btnPrimary, inputCls } from "./ui";

export function RecordsView() {
  const { state, reload } = usePhase1();
  const [learnings, setLearnings] = useState("");
  const [decision, setDecision] = useState("");
  const [track, setTrack] = useState("");
  const [note, setNote] = useState<string | null>(null);
  if (!state) return <Loading />;
  const reviews = [...state.programme.reviews].sort((a, b) => b.reviewed_on.localeCompare(a.reviewed_on) || b.created_at.localeCompare(a.created_at));
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    const res = await fetch("/phase1/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ learnings, decision, track_key: track }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return setNote(j.error ?? "Could not save");
    setLearnings("");
    setDecision("");
    await reload();
  }
  return (
    <div>
      <Title title="Records" sub="What was reviewed after each batch, what was learned, what was decided." />
      <form onSubmit={add} className="mb-6 grid gap-3 rounded-card border border-arepo-border bg-white p-4 text-sm">
        <h2 className="font-medium text-arepo-ink">Add a review</h2>
        <select className={inputCls} value={track} onChange={(e) => setTrack(e.target.value)} aria-label="Track">
          <option value="">All tracks</option>
          {state.programme.tracks.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
        <textarea className={inputCls} rows={3} placeholder="What we learned" value={learnings} onChange={(e) => setLearnings(e.target.value)} />
        <input className={inputCls} placeholder="What we decided" value={decision} onChange={(e) => setDecision(e.target.value)} />
        <div className="flex items-center gap-3"><button className={btnPrimary} type="submit" disabled={!learnings.trim() && !decision.trim()}>Save review</button>{note && <Banner tone="warn">{note}</Banner>}</div>
      </form>
      {reviews.length === 0 && <p className="text-sm text-arepo-muted">No reviews yet. One is added after each batch.</p>}
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li key={r.id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
            <div className="flex flex-wrap gap-2 text-arepo-muted"><span className="font-medium text-arepo-ink">{r.reviewed_on}</span>{r.track_key && <span>{r.track_key}</span>}{r.sends != null && <span>{r.sends} sent</span>}</div>
            {r.learnings && <p className="mt-1 whitespace-pre-wrap text-arepo-ink2">{r.learnings}</p>}
            {r.decision && <p className="mt-1 text-arepo-ink">Decision: {r.decision}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
