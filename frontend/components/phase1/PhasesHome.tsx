"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BLOCKED_STATUSES, CALL_STATUSES, computePhaseResult, londonToday, messageVoice, prospectFacts, renderMessage, selectBatch, senderKey, sentBy, slug, variantKeys, variantText,
  type BatchItem, type PhaseResult,
} from "@/lib/phase1/programme";
import { emailHtml } from "@/lib/phase1/signature";
import { randomGapSeconds } from "@/lib/phase1/send";
import type { Phase, ProgrammeMessage, ProgrammeProspect, Track } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { GenerateLeads, NewLeads } from "./Leads";
import { PlaybookReply, needsAnswer } from "./ReplyPlaybook";
import { Banner, Loading, Pill, StatusBanners, btnCls, btnPrimary, fmtDate, inputCls } from "./ui";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STEP_LABEL: Record<string, string> = { first: "First email", followup1: "Follow-up 1", followup2: "Follow-up 2" };
const TONE = { planned: "neutral", active: "warn", judged: "pos" } as const;
type Progress = Record<string, { status: "waiting" | "sending" | "sent" | "failed"; error?: string }>;
type Voice = { key: string; label: string };

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
/** "Thu 19 Nov" from "2026-11-19". */
function fmtDay(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(d);
}

const GMAIL_NOTE: Record<string, string> = {
  connected: "Gmail connected.",
  alias_missing: "Gmail connected, but the arepolabs address is not set up as a verified \"Send mail as\" address in that Gmail yet. Sends stay off until it is.",
  cancelled: "Gmail sign-in was cancelled or expired. Try again.",
  no_refresh_token: "Google did not give a long-lived token. Remove Arepo from the Google account's third-party access and connect again.",
  not_configured: "Gmail is not configured on this server yet.",
};

/**
 * The one page: a tab per person (Dayyan = startups, Jack = local trades), each showing only its own track, and on
 * every phase card Preview email, Recipients and Send. Send only works on your own tab, from your own connected
 * Gmail, with copy in your voice.
 */
export function PhasesHome() {
  const { state, act, reload } = usePhase1();
  const [tab, setTab] = useState<string | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<Progress | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [gmailNote, setGmailNote] = useState<string | null>(null);
  const stop = useRef(false);
  useEffect(() => { setGmailNote(new URLSearchParams(window.location.search).get("gmail")); }, []);

  const prog = state?.programme;
  const me = senderKey(state?.me.name ?? state?.me.email);
  const voices = useMemo<Voice[]>(() => {
    if (!state || !prog) return [];
    const keys: string[] = [];
    for (const t of prog.tracks) {
      const k = senderKey(t.sender);
      if (k && !keys.includes(k)) keys.push(k);
    }
    const label = (k: string) => {
      const person = state.people.find((p) => senderKey(p.name ?? p.email) === k);
      const t = prog.tracks.find((t) => senderKey(t.sender) === k);
      return (person?.name ?? t?.sender ?? cap(k)).split(/\s+/)[0]!;
    };
    return keys.map((k) => ({ key: k, label: label(k) }));
  }, [state, prog]);
  const current = tab ?? (voices.some((v) => v.key === me) ? me : voices[0]?.key ?? "");
  const own = current === me;

  // Each tab shows only its own track(s): the tracks whose sender is this person.
  const myTracks = useMemo(() => (prog ? prog.tracks.filter((t) => senderKey(t.sender) === current) : []), [prog, current]);
  const trackKeys = useMemo(() => myTracks.map((t) => t.key), [myTracks]);
  const inTrack = (p: Pick<ProgrammeProspect, "track_key">) => trackKeys.some((k) => slug(k) === slug(p.track_key));

  const batch = useMemo<BatchItem[]>(() => {
    if (!state || !prog || !current) return [];
    return selectBatch({ messages: prog.messages, prospects: prog.prospects, phases: prog.phases, core: state.prospects, now: new Date(), sender: current, tracks: prog.tracks, trackKeys });
  }, [state, prog, current, trackKeys]);

  if (!state || !prog) return <Loading />;
  const facts = prospectFacts(prog.prospects, prog.messages, state.prospects, state.replies, state.events);
  const now = new Date();
  const today = londonToday(now);
  const voiceLabel = voices.find((v) => v.key === current)?.label ?? cap(current);
  const myBox = state.mailboxes.find((m) => m.kind === "personal" && m.owner_id === state.me.personId) ?? null;
  const mailbox = myBox && myBox.status === "connected" && myBox.send_as_verified && myBox.send_as ? myBox : null;
  /** Why Send cannot be used yet, in plain words (null when Gmail is ready). */
  const gmailReason: string | null = mailbox ? null :
    !state.gmail.configured ? "Gmail is not set up on this server yet" :
    !myBox ? "Connect Gmail first" :
    myBox.status !== "connected" ? "Reconnect Gmail first" :
    "Gmail connected but the arepolabs address is not verified as Send mail as yet";
  const trackProspectIds = new Set(prog.prospects.filter(inTrack).map((p) => p.prospect_id).filter(Boolean) as string[]);
  const anyProgrammeIds = new Set(prog.prospects.map((p) => p.prospect_id).filter(Boolean) as string[]);
  const waiting = state.replies.filter(needsAnswer).filter((r) => (r.prospect_id && trackProspectIds.has(r.prospect_id)) || (own && !(r.prospect_id && anyProgrammeIds.has(r.prospect_id)))).sort((a, b) => b.received_at.localeCompare(a.received_at));

  // "Next send": the earliest day this voice still has pending copy for someone who can be emailed.
  const upcoming = prog.messages.filter((m) => {
    if (m.status !== "pending" || !m.send_on) return false;
    const p = prog.prospects.find((x) => x.ext_id === m.prospect_ext_id);
    if (!p || !inTrack(p) || BLOCKED_STATUSES.has(p.status) || messageVoice(m, p, prog.tracks) !== current) return false;
    const ph = prog.phases.find((x) => x.phase_id === p.phase_id);
    return ph?.status !== "planned";
  });
  const nextDay = upcoming.map((m) => (m.send_on! < today ? today : m.send_on!)).sort()[0] ?? null;
  const nextCount = nextDay ? upcoming.filter((m) => (m.send_on! < today ? today : m.send_on!) === nextDay).length : 0;

  const ticked = (ids: string[]) => ids.filter((id) => !unticked.has(id));
  const toggle = (id: string) => setUnticked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function send(ids: string[]) {
    setNote(null);
    stop.current = false;
    try {
      const q = await act<{ emails: { id: string; message_id: string }[]; skipped: { message_id: string; reason: string }[] }>("programme.queue", { message_ids: ids }, { reload: false });
      const init: Progress = {};
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
    <div className="space-y-6">
      <div role="tablist" aria-label="Sender" className="flex gap-1 border-b border-arepo-border">
        {voices.map((v) => (
          <button key={v.key} role="tab" aria-selected={v.key === current} onClick={() => { setTab(v.key); setProgress(null); setNote(null); }}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${v.key === current ? "border-arepo-accent font-medium text-arepo-ink" : "border-transparent text-arepo-muted hover:text-arepo-ink"}`}>
            {v.label}{v.key === me ? " (you)" : ""}
          </button>
        ))}
      </div>

      <StatusBanners />
      {gmailNote && GMAIL_NOTE[gmailNote] && <Banner tone={gmailNote === "connected" ? "info" : "warn"}>{GMAIL_NOTE[gmailNote]}</Banner>}
      {prog.tracks.length === 0 && <Banner>No programme is loaded yet. Once it is, the phases appear here.</Banner>}

      <section aria-label="Status" className="rounded-card border border-arepo-border bg-white p-4 text-sm">
        <p className="text-arepo-ink">
          {nextDay ? <>Next send: <span className="font-medium">{nextDay === today ? "today" : fmtDay(nextDay)}</span>, {nextCount} email{nextCount === 1 ? "" : "s"} ready{batch.length ? ` (${batch.length} due now)` : ""}.</> : "Nothing is waiting to be sent."}
        </p>
        <p className="mt-1 text-arepo-muted">
          {own ? (
            mailbox ? <>Sending from <span className="text-arepo-ink">{mailbox.send_as}</span>. <a className="underline" href="/phase1/api/gmail/connect?kind=personal">Reconnect</a></> :
            state.gmail.configured ? <>Connect your Gmail to send. <a className={`${btnCls} ml-2`} href="/phase1/api/gmail/connect?kind=personal">Connect Gmail</a></> :
            "Gmail is not set up on this server yet."
          ) : `${voiceLabel} sends these from their own Gmail. You can look, but only ${voiceLabel} can send from this tab.`}
        </p>
        {progress && (
          <div className="mt-3">
            <Banner tone={failed ? "warn" : "info"}>{running ? `Sending: ${done} done${failed ? `, ${failed} failed` : ""}${countdown ? `, next in ${countdown}s` : ""}. Keep this page open.` : `Finished: ${done} sent${failed ? `, ${failed} failed` : ""}.`}</Banner>
            {running ? <button className={`${btnCls} mt-2`} onClick={() => (stop.current = true)}>Stop after this one</button> : <button className={`${btnCls} mt-2`} onClick={() => setProgress(null)}>Close</button>}
          </div>
        )}
        {note && <div className="mt-3"><Banner tone="warn">{note}</Banner></div>}
      </section>

      {myTracks.map((t) => {
        const phases = prog.phases.filter((p) => p.track_key === t.key).sort((a, b) => a.ord - b.ord);
        if (!phases.length) return null;
        return (
          <section key={t.key} aria-label={t.name}>
            <h2 className="font-display text-lg text-arepo-ink">{t.name}</h2>
            <div className="mt-3 space-y-4">
              {phases.map((ph) => (
                <PhaseCard key={ph.phase_id} phase={ph} voice={current} voices={voices} own={own} sendAs={mailbox?.send_as ?? null} gmailReason={gmailReason} today={today}
                  prospects={prog.prospects.filter((p) => p.phase_id === ph.phase_id && inTrack(p))} messages={prog.messages} tracks={prog.tracks} phases={prog.phases}
                  batch={batch.filter((i) => i.prospect.phase_id === ph.phase_id)} result={computePhaseResult(ph, facts, now)}
                  unticked={unticked} toggle={toggle} ticked={ticked} busy={running} progress={progress} onSend={send}
                  onAccept={() => act("phase.accept", { phase_id: ph.phase_id }).catch((e) => setNote(String(e.message ?? e)))} />
              ))}
            </div>
          </section>
        );
      })}

      <section aria-label="Leads" className="rounded-card border border-arepo-border bg-white p-5">
        <h2 className="font-display text-lg text-arepo-ink">More prospects</h2>
        <p className="mt-1 text-sm text-arepo-muted">Ask TENET for a new batch; new leads come back here for a quick yes or no before they join a phase.</p>
        <GenerateLeads />
      </section>
      <NewLeads />

      <section aria-label="Replies waiting">
        <h2 className="font-display text-lg text-arepo-ink">Replies waiting <span className="text-arepo-muted">({waiting.length})</span></h2>
        {waiting.length === 0 && <p className="mt-2 text-sm text-arepo-muted">No replies waiting for you.</p>}
        <ul className="mt-3 space-y-3">
          {waiting.slice(0, 3).map((r) => {
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
        {waiting.length > 3 && <Link className="mt-2 inline-block text-sm underline" href="/phase1/replies">See all {waiting.length}</Link>}
      </section>

      <footer className="flex flex-wrap gap-4 border-t border-arepo-border pt-4 text-sm text-arepo-muted">
        <Link className="underline" href="/phase1/prospects">All prospects ({prog.prospects.length})</Link>
        <Link className="underline" href="/phase1/replies">All replies</Link>
        <Link className="underline" href="/phase1/profiles">Site profiles</Link>
      </footer>
    </div>
  );
}

function PhaseCard({ phase, voice, voices, own, sendAs, gmailReason, today, prospects, messages, tracks, phases, batch, result, unticked, toggle, ticked, busy, progress, onSend, onAccept }: {
  phase: Phase; voice: string; voices: Voice[]; own: boolean; sendAs: string | null; gmailReason: string | null; today: string;
  prospects: ProgrammeProspect[]; messages: ProgrammeMessage[]; tracks: Track[]; phases: Phase[]; batch: BatchItem[]; result: PhaseResult;
  unticked: Set<string>; toggle: (id: string) => void; ticked: (ids: string[]) => string[]; busy: boolean; progress: Progress | null;
  onSend: (ids: string[]) => void; onAccept: () => void;
}) {
  const [show, setShow] = useState<"preview" | "recipients" | null>(null);
  const [confirm, setConfirm] = useState<"first" | "followup" | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const label = (k: string | null) => (k ? voices.find((v) => v.key === k)?.label ?? cap(k) : "");
  const keys = variantKeys(phase);
  const variants = phase.variants && typeof phase.variants === "object" ? (phase.variants as Record<string, unknown>) : {};
  const inVoice = (p: ProgrammeProspect, step = "first") => messages.find((m) => m.prospect_ext_id === p.ext_id && m.step === step && messageVoice(m, p, tracks) === voice) ?? null;
  const hasCopy = prospects.some((p) => inVoice(p));
  const firsts = batch.filter((i) => i.step === "first" && !i.unresolved.length).map((i) => i.message.id);
  const followups = batch.filter((i) => i.step !== "first" && !i.unresolved.length).map((i) => i.message.id);
  const nFirst = ticked(firsts).length;
  const nFollow = ticked(followups).length;
  const canSend = own && !!sendAs && !busy;
  // The next day this phase has copy waiting in this voice, for the reason shown beside a disabled Send button.
  const pendingDays = (step: "first" | "later") => prospects
    .filter((p) => !BLOCKED_STATUSES.has(p.status))
    .flatMap((p) => messages.filter((m) => m.prospect_ext_id === p.ext_id && m.status === "pending" && !!m.send_on && (step === "first" ? m.step === "first" : m.step !== "first") && messageVoice(m, p, tracks) === voice))
    .map((m) => (m.send_on! < today ? today : m.send_on!)).sort();
  const nextFirst = pendingDays("first")[0] ?? null;
  const nextLater = pendingDays("later")[0] ?? null;
  const planned = phase.status === "planned";
  const sendReason: string | null =
    busy ? "Sending is in progress" :
    gmailReason ? gmailReason :
    planned ? "This phase starts once the one before it is judged" :
    !firsts.length ? (nextFirst ? `First emails go out ${nextFirst === today ? "today" : fmtDay(nextFirst)}` : "No first emails are waiting in this phase") :
    !nFirst ? "Tick at least one recipient" : null;
  const followReason: string | null = busy ? null : gmailReason ?? (!nFollow ? "Tick at least one recipient" : null);
  const sorted = [...prospects].sort((a, b) => (a.variant ?? "").localeCompare(b.variant ?? "") || a.company.localeCompare(b.company));

  function rowState(p: ProgrammeProspect): { text: string; tone: "neutral" | "pos" | "neg" | "warn"; item?: BatchItem; off?: boolean } {
    const by = sentBy(p, messages, tracks);
    const item = batch.find((i) => i.prospect.ext_id === p.ext_id);
    if (p.status === "new") return { text: "New lead, needs a yes", tone: "warn", off: true };
    if (CALL_STATUSES.has(p.status)) return { text: "Call booked", tone: "pos", off: true };
    if (p.status === "replied") return { text: "Replied", tone: "pos", off: true };
    if (p.status === "bounced") return { text: "Bounced", tone: "neg", off: true };
    if (BLOCKED_STATUSES.has(p.status)) return { text: p.status.replace(/_/g, " "), tone: "neg", off: true };
    if (item) return { text: item.step === "first" ? (item.overdue ? "Overdue" : "Due today") : `${STEP_LABEL[item.step]} due`, tone: "warn", item };
    if (by === voice) {
      const sent = messages.find((m) => m.prospect_ext_id === p.ext_id && m.step === "first" && m.status === "sent");
      const next = messages.find((m) => m.prospect_ext_id === p.ext_id && m.step !== "first" && m.status === "pending" && messageVoice(m, p, tracks) === voice);
      return { text: `Sent ${fmtDay(sent?.sent_at?.slice(0, 10) ?? sent?.send_on)}${next ? `, ${STEP_LABEL[next.step]!.toLowerCase()} ${fmtDay(next.send_on)}` : ""}`, tone: "pos", off: true };
    }
    const m = inVoice(p);
    if (!m) return { text: `No email in ${own ? "your" : `${label(voice)}'s`} voice yet`, tone: "neutral", off: true };
    if (m.status === "skipped") return { text: "Skipped", tone: "neutral", off: true };
    const r = renderMessage(m, p, phases);
    if (r.unresolved.length) return { text: "Needs filling", tone: "neg", off: true };
    return { text: `Ready ${fmtDay(m.send_on)}`, tone: "neutral", off: true };
  }

  return (
    <article className="rounded-card border border-arepo-border bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-arepo-ink">{phase.phase_id}: {phase.variable ?? "Phase"}</span>
        <Pill tone={TONE[phase.status]}>{phase.status}</Pill>
        {phase.judge_on && <span className="text-arepo-muted">judged {fmtDay(phase.judge_on)}</span>}
      </div>
      {keys.length > 0 && (
        <p className="mt-1 text-arepo-ink2">
          {keys.map((k, i) => <span key={k}>{i > 0 ? " vs " : ""}<span className="font-medium">{k}:</span> {variantText(variants[k])}</span>)}
          {phase.hypothesis ? <span className="text-arepo-muted"> ({phase.hypothesis})</span> : null}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={btnCls} aria-expanded={show === "preview"} onClick={() => setShow(show === "preview" ? null : "preview")}>Preview email</button>
        <button className={btnCls} aria-expanded={show === "recipients"} onClick={() => setShow(show === "recipients" ? null : "recipients")}>Recipients ({prospects.length})</button>
        {own && hasCopy && !confirm && <button className={btnPrimary} disabled={!canSend || !nFirst || !firsts.length} onClick={() => setConfirm("first")}>{nFirst ? `Send ${nFirst} email${nFirst === 1 ? "" : "s"}` : "Send emails"}</button>}
        {own && hasCopy && !confirm && sendReason && <span className="text-arepo-muted">{sendReason}</span>}
        {own && hasCopy && followups.length > 0 && !confirm && <button className={btnPrimary} disabled={!canSend || !nFollow} onClick={() => setConfirm("followup")}>Send {nFollow} follow-up{nFollow === 1 ? "" : "s"}</button>}
        {own && hasCopy && followups.length > 0 && !confirm && followReason && <span className="text-arepo-muted">{followReason}</span>}
        {own && hasCopy && !confirm && !followups.length && nextLater && !sendReason && <span className="text-arepo-muted">Follow-ups go out {fmtDay(nextLater)}</span>}
        {own && !hasCopy && <span className="text-arepo-muted">No emails in your voice yet.</span>}
      </div>
      {confirm && (
        <div className="mt-3 rounded-control border border-arepo-border bg-arepo-surface2 p-3">
          <p className="text-arepo-ink">Send {confirm === "first" ? nFirst : nFollow} {confirm === "first" ? "email" : "follow-up"}{(confirm === "first" ? nFirst : nFollow) === 1 ? "" : "s"} from {sendAs}? They go one at a time with a short pause, each with the opt-out line.</p>
          <div className="mt-2 flex gap-2">
            <button className={btnPrimary} onClick={() => { setConfirm(null); onSend(ticked(confirm === "first" ? firsts : followups)); }}>Yes, send</button>
            <button className={btnCls} onClick={() => setConfirm(null)}>Not now</button>
          </div>
        </div>
      )}

      {show === "preview" && own && (
        <TestSend messageIds={(keys.length ? keys : [""]).map((k) => { const g = sorted.filter((p) => (k ? p.variant === k : true) && inVoice(p)); const c = g.find((p) => p.ext_id === pick[k]) ?? g[0]; const m = c ? inVoice(c) : null; return m?.id ?? ""; }).filter(Boolean)} />
      )}
      {show === "preview" && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(keys.length ? keys : [""]).map((k) => {
            const group = sorted.filter((p) => (k ? p.variant === k : true) && inVoice(p));
            const chosen = group.find((p) => p.ext_id === pick[k]) ?? group[0];
            const m = chosen ? inVoice(chosen) : null;
            const r = chosen && m ? renderMessage(m, chosen, phases) : null;
            return (
              <div key={k} className="rounded-control border border-arepo-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {k && <span className="font-medium text-arepo-ink">Variant {k}</span>}
                  {group.length > 0 && (
                    <select className={`${inputCls} py-1`} aria-label={`Recipient for variant ${k}`} value={chosen?.ext_id ?? ""} onChange={(e) => setPick({ ...pick, [k]: e.target.value })}>
                      {group.map((p) => <option key={p.ext_id} value={p.ext_id}>{p.company}</option>)}
                    </select>
                  )}
                </div>
                {!r ? <p className="mt-2 text-arepo-muted">No email in {own ? "your" : `${label(voice)}'s`} voice yet.</p> : (
                  <div className="mt-2">
                    <div className="text-arepo-muted">To {chosen!.contact_name ? `${chosen!.contact_name} <${chosen!.email}>` : chosen!.email}</div>
                    <div className="mt-1 font-medium text-arepo-ink">{r.subject}</div>
                    <div className="mt-2 text-arepo-ink2 [&_a]:text-blue-700 [&_a]:underline [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: emailHtml(r.body, sendAs) }} />
                    {r.unresolved.length > 0 && <p className="mt-2 text-red-700">Unfilled: {r.unresolved.join(" ")}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {show === "recipients" && (
        <ul className="mt-3 divide-y divide-arepo-border">
          {sorted.map((p) => {
            const st = rowState(p);
            const id = st.item?.message.id;
            const sent = id ? progress?.[id] : undefined;
            return (
              <li key={p.ext_id} className={`flex flex-wrap items-center gap-2 py-2 ${st.off ? "text-arepo-muted" : ""}`}>
                {own && id ? <input type="checkbox" aria-label={`Send to ${p.company}`} checked={!unticked.has(id)} disabled={busy} onChange={() => toggle(id)} /> : <span className="inline-block w-[13px]" />}
                <span className={`min-w-0 flex-1 ${st.off ? "" : "text-arepo-ink"}`}>
                  <span className="font-medium">{p.company}</span>
                  {p.contact_name && <span className="text-arepo-muted"> · {p.contact_name}</span>}
                  <span className="text-arepo-muted"> · {p.email ?? "no email"}</span>
                </span>
                {p.variant && <Pill>{p.variant}</Pill>}
                {sent ? <Pill tone={sent.status === "sent" ? "pos" : sent.status === "failed" ? "neg" : "neutral"}>{sent.status === "failed" ? sent.error : sent.status}</Pill> : <Pill tone={st.tone}>{st.text}</Pill>}
              </li>
            );
          })}
          {sorted.length === 0 && <li className="py-2 text-arepo-muted">No one in this phase yet.</li>}
        </ul>
      )}

      <p className="mt-3 text-xs text-arepo-muted">
        {result.rows.map((r, i) => <span key={r.key}>{i > 0 ? " · " : ""}{r.key}: {r.sent} sent, {r.replied} replied, {r.positive} positive{r.calls ? `, ${r.calls} calls` : ""}</span>)}
        {phase.status === "judged" ? ` · Winner: ${phase.winner === "none" || !phase.winner ? "no clear winner" : phase.winner}` : phase.status === "active" || result.due ? ` · ${result.summary}` : ""}
      </p>
      {phase.status !== "judged" && result.due && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className={btnCls} onClick={onAccept}>Accept result</button>
          {result.next && <span className="text-xs text-arepo-muted">Then: {result.next}</span>}
        </div>
      )}
    </article>
  );
}

/** Send a test copy of the previewed email (one per version) to an address you type. Nothing is recorded and nothing counts. */
function TestSend({ messageIds }: { messageIds: string[] }) {
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function go(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/phase1/api/test-send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageId: id, to }) });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? { ok: true, text: `Test sent to ${j.to ?? to}` } : { ok: false, text: j.reconnect ? "Reconnect Gmail" : j.error ?? "Could not send the test" });
    } catch {
      setMsg({ ok: false, text: "Network error" });
    }
    setBusy(false);
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-control border border-arepo-border bg-arepo-surface2 p-3">
      <input type="email" className={`${inputCls} min-w-[16rem]`} placeholder="Send a test to this address" aria-label="Test email address" value={to} onChange={(e) => setTo(e.target.value)} />
      {messageIds.map((id, i) => (
        <button key={id} className={btnCls} disabled={busy || !to.trim()} onClick={() => go(id)}>{messageIds.length > 1 ? `Send test ${String.fromCharCode(65 + i)}` : "Send test"}</button>
      ))}
      {msg && <span className={msg.ok ? "text-arepo-pos" : "text-red-700"}>{msg.text}</span>}
      <span className="w-full text-xs text-arepo-muted">Sends the exact email to this address only. Nothing is recorded.</span>
    </div>
  );
}
