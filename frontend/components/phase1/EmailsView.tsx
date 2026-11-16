"use client";

import { useState } from "react";
import { testWinner, variantScore } from "@/lib/phase1/metrics";
import type { Row, VariantKind } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { Banner, Loading, Pill, StatusBanners, Title, btnCls, btnPrimary, fmtDate, inputCls } from "./ui";

type V = Row<"variants">;
const KINDS: { kind: VariantKind; label: string }[] = [
  { kind: "subject", label: "Subjects" }, { kind: "body", label: "Bodies" }, { kind: "opener", label: "Openers" },
  { kind: "ask", label: "Asks" }, { kind: "follow_up", label: "Follow-ups" }, { kind: "signature", label: "Signatures" },
];

export function EmailsView() {
  const { state, act } = usePhase1();
  const [tab, setTab] = useState<"variants" | "tests" | "batches" | "log">("variants");
  const [kind, setKind] = useState<VariantKind>("subject");
  const [edit, setEdit] = useState<Partial<V> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!state) return <Loading />;

  const emails = state.outreach_emails, replies = state.replies, events = state.events;
  const vById = (id: string | null) => state.variants.find((v) => v.id === id);
  const run = async (fn: () => Promise<unknown>) => { try { await fn(); setMsg(null); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); } };

  const tabs = [["variants", "Variants"], ["tests", "Tests"], ["batches", "Batches"], ["log", "Sent log"]] as const;
  const list = state.variants.filter((v) => v.kind === kind);

  return (
    <div>
      <Title title="Emails" sub="Variants, split tests and batches. Wording from the doc 08 drafts is kept as written." />
      <StatusBanners gmail={false} />
      {msg && <div className="mb-3"><Banner tone="bad">{msg}</Banner></div>}
      <div className="mb-4 flex gap-2" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`${btnCls} ${tab === k ? "border-arepo-ink" : ""}`}>{l}</button>)}
      </div>

      {tab === "variants" && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {KINDS.map((k) => <button key={k.kind} onClick={() => setKind(k.kind)} className={`${btnCls} ${kind === k.kind ? "border-arepo-ink" : ""}`}>{k.label} ({state.variants.filter((v) => v.kind === k.kind).length})</button>)}
            <button className={btnPrimary} onClick={() => setEdit({ kind, code: "", text: "", label: "" })}>Add a variant</button>
          </div>
          <ul className="space-y-2">
            {list.map((v) => {
              const sc = variantScore(v.id, emails, replies, events);
              return (
                <li key={v.id} className="rounded-card border border-arepo-border bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-arepo-ink">{v.code}</span>
                    {v.label && <span className="text-arepo-muted">{v.label}</span>}
                    {v.tone && <Pill>{v.tone}</Pill>}{v.audience && <Pill>{v.audience}</Pill>}
                    <Pill tone={v.status === "active" ? "pos" : "neutral"}>{v.status}</Pill>
                    <span className="text-arepo-muted">{sc.sent} sent, {sc.wins} positive or booked</span>
                    <span className="ml-auto flex gap-2">
                      <button className={btnCls} onClick={() => setEdit(v)}>Edit</button>
                      <button className={btnCls} onClick={() => run(() => act("variant.retire", { id: v.id, retired: v.status === "active" }))}>{v.status === "active" ? "Retire" : "Restore"}</button>
                    </span>
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-arepo-ink2">{v.text}</pre>
                </li>
              );
            })}
            {list.length === 0 && <li className="text-sm text-arepo-muted">None yet.</li>}
          </ul>
          {edit && (
            <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Variant">
              <div className="mx-auto max-w-2xl space-y-3 rounded-card border border-arepo-border bg-arepo-bg p-5">
                <h2 className="font-display text-lg">{edit.id ? "Edit variant" : "New variant"} ({edit.kind})</h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input className={inputCls} placeholder="Code (e.g. V3)" value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Label" value={edit.label ?? ""} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
                  <select className={inputCls} value={edit.tone ?? ""} onChange={(e) => setEdit({ ...edit, tone: (e.target.value || null) as V["tone"] })}><option value="">Tone</option><option>homely</option><option>professional</option><option>neutral</option></select>
                  <select className={inputCls} value={edit.audience ?? ""} onChange={(e) => setEdit({ ...edit, audience: (e.target.value || null) as V["audience"] })}><option value="">Audience</option><option>trades</option><option>shops</option><option>cafes</option><option>ai_keen</option><option>all</option></select>
                </div>
                <textarea className={`${inputCls} w-full font-mono text-[13px]`} rows={12} value={edit.text ?? ""} onChange={(e) => setEdit({ ...edit, text: e.target.value })} aria-label="Text" />
                <p className="text-xs text-arepo-muted">Merge fields: {"{first_name} {business} {opener} {subject_hint}"}. Bodies must end with the opt-out line; the send step adds it if missing.</p>
                <div className="flex gap-2">
                  <button className={btnPrimary} onClick={() => run(async () => { await act("variant.save", { ...edit }); setEdit(null); })}>Save</button>
                  <button className={btnCls} onClick={() => setEdit(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "tests" && (
        <ul className="space-y-3">
          {state.tests.map((t) => {
            const a = vById(t.variant_a_id), b = vById(t.variant_b_id);
            const sa = variantScore(t.variant_a_id, emails, replies, events, t.id), sb = variantScore(t.variant_b_id, emails, replies, events, t.id);
            const w = testWinner(sa.wins, sb.wins);
            return (
              <li key={t.id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-arepo-ink">{t.name}</span>
                  <Pill>{t.variable}</Pill>
                  <Pill tone={t.decided_at ? "pos" : t.started_at ? "warn" : "neutral"}>{t.decided_at ? `decided: ${t.winner}` : t.started_at ? "running" : "not started"}</Pill>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-control bg-arepo-surface2 p-2"><b>A {a?.code ?? "?"}</b>: {a?.text.slice(0, 80)}<div className="text-arepo-muted">{sa.sent} sent, {sa.wins} positive or booked</div></div>
                  <div className="rounded-control bg-arepo-surface2 p-2"><b>B {b?.code ?? "?"}</b>: {b?.text.slice(0, 80)}<div className="text-arepo-muted">{sb.sent} sent, {sb.wins} positive or booked</div></div>
                </div>
                <p className="mt-2 text-arepo-ink2">{t.decision_rule}</p>
                <p className="mt-1 text-arepo-ink2">Right now: {w.winner === "none" ? w.reason : `${w.winner.toUpperCase()} is ahead (${w.reason})`}. Judge 5 working days after the last email.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {!t.started_at && <button className={btnCls} onClick={() => run(() => act("test.start", { id: t.id }))}>Start</button>}
                  {t.started_at && !t.decided_at && (
                    <>
                      <button className={btnCls} onClick={() => run(() => act("test.decide", { id: t.id, winner: w.winner, result: w.reason }))}>Record: {w.winner === "none" ? "no winner" : `${w.winner.toUpperCase()} wins`}</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {state.tests.length === 0 && <li className="text-sm text-arepo-muted">No tests loaded yet.</li>}
        </ul>
      )}

      {tab === "batches" && (
        <ul className="space-y-2">
          {state.batches.map((bt) => {
            const sent = emails.filter((e) => e.batch_id === bt.id && e.sent_at).length;
            return (
              <li key={bt.id} className="rounded-card border border-arepo-border bg-white p-3 text-sm">
                <span className="font-medium text-arepo-ink">{bt.label}</span> <Pill>stage {bt.stage}</Pill>{" "}
                <span className="text-arepo-muted">{bt.planned_date ?? "no date"}, {sent} of {bt.size_planned ?? "?"} sent</span>
                {bt.notes && <p className="text-arepo-ink2">{bt.notes}</p>}
              </li>
            );
          })}
          {state.batches.length === 0 && <li className="text-sm text-arepo-muted">No batches yet. Stage 1 is 5 emails with subject A; the later stages follow the plan.</li>}
        </ul>
      )}

      {tab === "log" && (
        <div className="overflow-x-auto rounded-card border border-arepo-border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Via</th></tr></thead>
            <tbody>
              {[...emails].sort((a, b) => (b.sent_at ?? b.composed_at).localeCompare(a.sent_at ?? a.composed_at)).slice(0, 200).map((e) => (
                <tr key={e.id} className="border-t border-arepo-border">
                  <td className="px-3 py-2">{fmtDate(e.sent_at ?? e.composed_at)}</td><td className="px-3 py-2">{e.to_address}</td><td className="px-3 py-2">{e.subject}</td>
                  <td className="px-3 py-2"><Pill tone={e.status === "sent" || e.status === "replied" ? "pos" : e.status === "bounced" ? "neg" : "neutral"}>{e.status}</Pill>{e.send_error && <span className="ml-1 text-arepo-neg">{e.send_error}</span>}</td>
                  <td className="px-3 py-2">{e.sent_via ?? ""}</td>
                </tr>
              ))}
              {emails.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-arepo-muted">Nothing sent yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
