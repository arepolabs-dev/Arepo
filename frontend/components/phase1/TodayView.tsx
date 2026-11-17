"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { aheadInPhase, prospectFacts, selectBatch, tally, tracksForUser, type BatchItem } from "@/lib/phase1/programme";
import { randomGapSeconds } from "@/lib/phase1/send";
import { usePhase1 } from "./data";
import { PlaybookReply, needsAnswer } from "./ReplyPlaybook";
import { Banner, Loading, Pill, StatusBanners, Title, btnCls, btnPrimary, fmtDate, inputCls } from "./ui";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STEP_LABEL: Record<string, string> = { first: "First email", followup1: "Follow-up 1", followup2: "Follow-up 2" };
type Sent = Record<string, { status: "waiting" | "sending" | "sent" | "failed"; error?: string }>;

export function TodayView() {
  const { state, act, reload } = usePhase1();
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<Sent | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const stop = useRef(false);

  const prog = state?.programme;
  const batch = useMemo<BatchItem[]>(() => {
    if (!state || !prog) return [];
    return selectBatch({ messages: prog.messages, prospects: prog.prospects, phases: prog.phases, core: state.prospects, now: new Date(), trackKeys: tracksForUser(prog.tracks, { email: state.me.email, name: state.me.name }) });
  }, [state, prog]);

  if (!state || !prog) return <Loading />;
  const facts = prospectFacts(prog.prospects, prog.messages, state.prospects, state.replies, state.events);
  const all = tally(facts, "all")[0] ?? { sent: 0, replied: 0, positive: 0, calls: 0 };
  const current = prog.phases.find((p) => p.status === "active") ?? null;
  const ahead = current ? aheadInPhase(current, facts, new Date()) : null;
  const waiting = state.replies.filter(needsAnswer).sort((a, b) => b.received_at.localeCompare(a.received_at));
  const sendable = batch.filter((i) => !i.unresolved.length);
  const empty = prog.tracks.length === 0;

  async function sendAll() {
    setConfirming(false);
    setNote(null);
    stop.current = false;
    try {
      const q = await act<{ emails: { id: string; message_id: string; name: string }[]; skipped: { message_id: string; reason: string }[] }>("programme.queue", { message_ids: sendable.map((i) => i.message.id) }, { reload: false });
      const init: Sent = {};
      q.emails.forEach((e) => (init[e.message_id] = { status: "waiting" }));
      setProgress(init);
      if (q.skipped.length) setNote(`${q.skipped.length} skipped: ${q.skipped.map((s) => s.reason).slice(0, 3).join("; ")}`);
      for (let i = 0; i < q.emails.length; i++) {
        const e = q.emails[i]!;
        if (stop.current) break;
        setProgress((p) => ({ ...p, [e.message_id]: { status: "sending" } }));
        let halt = false;
        try {
          const res = await fetch("/phase1/api/gmail/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email_id: e.id }) });
          const j = await res.json().catch(() => ({}));
          if (res.ok) setProgress((p) => ({ ...p, [e.message_id]: { status: "sent" } }));
          else {
            setProgress((p) => ({ ...p, [e.message_id]: { status: "failed", error: j.error ?? "Failed" } }));
            if (j.reconnect || j.cap || j.alias === false) halt = true;
          }
        } catch {
          setProgress((p) => ({ ...p, [e.message_id]: { status: "failed", error: "Network error" } }));
        }
        if (halt) break;
        if (i < q.emails.length - 1) {
          let s = randomGapSeconds();
          while (s > 0 && !stop.current) {
            setCountdown(s--);
            await sleep(1000);
          }
          setCountdown(0);
        }
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not start the batch");
    }
    await reload();
  }

  const done = progress ? Object.values(progress).filter((x) => x.status === "sent").length : 0;
  const failed = progress ? Object.values(progress).filter((x) => x.status === "failed").length : 0;
  const running = !!progress && Object.values(progress).some((x) => x.status === "waiting" || x.status === "sending");

  return (
    <div className="space-y-8">
      <Title title="Today" sub="Send the batch, then check the replies." />
      <StatusBanners />
      {empty && <Banner>No programme is loaded yet. Once it is, today&apos;s emails appear here.</Banner>}

      <section aria-label="Scoreboard" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Sent", all.sent], ["Replies", all.replied], ["Positive", all.positive], ["Calls booked", all.calls]].map(([l, n]) => (
          <div key={l as string} className="rounded-card border border-arepo-border bg-white p-4">
            <div className="font-display text-3xl text-arepo-ink">{n}</div>
            <div className="mt-1 text-sm text-arepo-muted">{l}</div>
          </div>
        ))}
        <p className="col-span-2 text-sm text-arepo-muted sm:col-span-4">
          {current ? <>Current phase: <span className="text-arepo-ink">{current.variable ?? current.phase_id}</span>. {ahead?.key ? `Variant ${ahead.key} is ahead.` : ahead?.summary}</> : "No phase is active yet."}{" "}
          <Link className="underline" href="/phase1/phases">All phases</Link>
        </p>
      </section>

      <section aria-label="Today's batch" className="rounded-card border border-arepo-border bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg text-arepo-ink">Today&apos;s batch <span className="text-arepo-muted">({batch.length})</span></h2>
          {!progress && batch.length > 0 && !confirming && <button className={btnPrimary} disabled={!sendable.length} onClick={() => setConfirming(true)}>Send {sendable.length} email{sendable.length === 1 ? "" : "s"}</button>}
        </div>
        {confirming && (
          <div className="mt-3 rounded-control border border-arepo-border bg-arepo-surface2 p-3 text-sm">
            <p className="text-arepo-ink">Send {sendable.length} email{sendable.length === 1 ? "" : "s"} from your Gmail, one at a time with a short pause between? Each carries the opt-out line.</p>
            <div className="mt-2 flex gap-2"><button className={btnPrimary} onClick={sendAll}>Yes, send</button><button className={btnCls} onClick={() => setConfirming(false)}>Not now</button></div>
          </div>
        )}
        {progress && (
          <div className="mt-3 text-sm">
            <Banner tone={failed ? "warn" : "info"}>{running ? `Sending: ${done} done${failed ? `, ${failed} failed` : ""}${countdown ? `, next in ${countdown}s` : ""}. Keep this page open.` : `Finished: ${done} sent${failed ? `, ${failed} failed` : ""}.`}</Banner>
            {running && <button className={`${btnCls} mt-2`} onClick={() => (stop.current = true)}>Stop after this one</button>}
            {!running && <button className={`${btnCls} mt-2`} onClick={() => setProgress(null)}>Close</button>}
          </div>
        )}
        {note && <div className="mt-3"><Banner tone="warn">{note}</Banner></div>}
        {batch.length === 0 && !empty && <p className="mt-3 text-sm text-arepo-muted">Nothing is due today. Follow-ups appear on their day.</p>}
        <ul className="mt-3 divide-y divide-arepo-border">
          {batch.map((i) => {
            const st = progress?.[i.message.id];
            return (
              <li key={i.message.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button className="text-left font-medium text-arepo-ink hover:underline" onClick={() => setOpen(open === i.message.id ? null : i.message.id)}>{i.prospect.company}</button>
                  <span className="text-arepo-muted">{STEP_LABEL[i.step]}{i.prospect.variant ? ` · ${i.prospect.variant}` : ""}</span>
                  {i.overdue && <Pill tone="warn">overdue</Pill>}
                  {i.unresolved.length > 0 && <Pill tone="neg">needs filling</Pill>}
                  {st && <Pill tone={st.status === "sent" ? "pos" : st.status === "failed" ? "neg" : "neutral"}>{st.status === "failed" ? st.error : st.status}</Pill>}
                  {!progress && <button className="ml-auto text-xs text-arepo-muted hover:text-arepo-ink" onClick={() => act("programme.skip", { message_id: i.message.id }).catch((e) => setNote(String(e.message ?? e)))}>Skip</button>}
                </div>
                {open === i.message.id && (
                  <div className="mt-2 rounded-control bg-arepo-surface2 p-3">
                    <div className="text-arepo-muted">To {i.prospect.email}</div>
                    <div className="mt-1 text-arepo-ink">{i.subject}</div>
                    <p className="mt-1 whitespace-pre-wrap text-arepo-ink2">{i.body}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <GenerateLeads />
      </section>

      <NewLeads />

      <section aria-label="Replies waiting">
        <h2 className="font-display text-lg text-arepo-ink">Replies waiting <span className="text-arepo-muted">({waiting.length})</span></h2>
        {waiting.length === 0 && <p className="mt-2 text-sm text-arepo-muted">No replies waiting for you.</p>}
        <ul className="mt-3 space-y-3">
          {waiting.slice(0, 5).map((r) => {
            const p = state.prospects.find((x) => x.id === r.prospect_id);
            return (
              <li key={r.id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-arepo-ink">{p?.name ?? r.from_address}</span><span className="text-arepo-muted">{fmtDate(r.received_at)}</span></div>
                <p className="mt-1 whitespace-pre-wrap text-arepo-ink2">{r.snippet ?? r.body_text?.slice(0, 300)}</p>
                <PlaybookReply reply={r} />
              </li>
            );
          })}
        </ul>
        {waiting.length > 5 && <Link className="mt-2 inline-block text-sm underline" href="/phase1/replies">See all {waiting.length}</Link>}
      </section>
    </div>
  );
}

function GenerateLeads() {
  const { state, act } = usePhase1();
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState("");
  const [count, setCount] = useState(20);
  const [area, setArea] = useState("London, anywhere");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const tracks = state?.programme.tracks ?? [];
  const requests = [...(state?.programme.leadRequests ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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
    <div className="mt-4 border-t border-arepo-border pt-4">
      {!open && <button className={btnCls} onClick={() => setOpen(true)}>Generate new batch</button>}
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
          <div className="flex items-center gap-2 sm:col-span-2"><button className={btnPrimary} type="submit" disabled={!tracks.length}>Request leads</button><button className={btnCls} type="button" onClick={() => setOpen(false)}>Cancel</button>{msg && <span className="text-arepo-neg">{msg}</span>}</div>
        </form>
      )}
      {requests.length > 0 && <ul className="mt-3 space-y-1 text-sm text-arepo-muted">{requests.map((r) => <li key={r.id}>{line(r)}</li>)}</ul>}
    </div>
  );
}

function NewLeads() {
  const { state, act } = usePhase1();
  const [note, setNote] = useState<string | null>(null);
  const leads = (state?.programme.prospects ?? []).filter((p) => p.status === "new");
  if (!leads.length) return null;
  const decide = (ext_id: string, decision: "approve" | "skip") => act("lead.review", { ext_id, decision }).catch((e) => setNote(String(e.message ?? e)));
  return (
    <section aria-label="New leads" className="rounded-card border border-arepo-border bg-white p-5">
      <h2 className="font-display text-lg text-arepo-ink">New leads ({leads.length}) to review</h2>
      <p className="mt-1 text-sm text-arepo-muted">Only approved leads go into the next batch.</p>
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
