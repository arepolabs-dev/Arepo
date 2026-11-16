"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Row } from "@/lib/phase1/types";
import { OPT_OUT, mailtoLink, renderEmail, type Sender } from "@/lib/phase1/merge";
import { checkSendable } from "@/lib/phase1/rules";
import { DAILY_CAP, GAP_MAX_SECONDS, GAP_MIN_SECONDS, randomGapSeconds } from "@/lib/phase1/send";
import { londonDayStart } from "@/lib/phase1/metrics";
import { usePhase1 } from "./data";
import { Banner, Pill, btnCls, btnPrimary, inputCls } from "./ui";

type Prospect = Row<"prospects">;
type QItem = { id: string; prospectId: string; name: string; to: string; subject: string; body: string; status: "waiting" | "sending" | "sent" | "failed" | "cancelled"; error?: string };

const SENDER_KEY = "phase1-sender";

function loadSender(): { phone: string; bookingLink: string; business: string } {
  try {
    const j = JSON.parse(localStorage.getItem(SENDER_KEY) ?? "{}");
    return { phone: j.phone ?? "", bookingLink: j.bookingLink ?? "", business: j.business ?? "Arepo Labs" };
  } catch {
    return { phone: "", bookingLink: "", business: "Arepo Labs" };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function SendPanel({ prospects, resumeIds, onClose }: { prospects: Prospect[]; resumeIds?: string[]; onClose: () => void }) {
  const { state, act, reload } = usePhase1();
  const [subjectId, setSubjectId] = useState("");
  const [bodyId, setBodyId] = useState("");
  const [sigId, setSigId] = useState("");
  const [testId, setTestId] = useState("");
  const [opener, setOpener] = useState<"specific" | "general">("specific");
  const [mailboxId, setMailboxId] = useState("");
  const [details, setDetails] = useState({ phone: "", bookingLink: "", business: "Arepo Labs" });
  const [edits, setEdits] = useState<Record<string, { subject?: string; body?: string }>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [queue, setQueue] = useState<QItem[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [reconnect, setReconnect] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const ctl = useRef({ paused: false, cancelled: false, running: false });

  useEffect(() => setDetails(loadSender()), []);
  const saveDetails = (d: typeof details) => {
    setDetails(d);
    try {
      localStorage.setItem(SENDER_KEY, JSON.stringify(d));
    } catch {
      /* optional */
    }
  };

  const variants = useMemo(() => state?.variants ?? [], [state?.variants]);
  const active = (kind: string) => variants.filter((v) => v.kind === kind && v.status === "active");
  const subjects = active("subject");
  const bodies = active("body");
  const sigs = active("signature");
  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects.find((v) => v.code === "A")?.id ?? subjects[0]!.id);
    if (!bodyId && bodies.length) setBodyId(bodies.find((v) => v.code === "V2A")?.id ?? bodies[0]!.id);
    if (!sigId && sigs.length) setSigId(sigs.find((v) => v.code === "V2")?.id ?? "");
  }, [subjects, bodies, sigs, subjectId, bodyId, sigId]);

  const me = state?.me;
  const sentToday = (mid: string) => {
    const since = londonDayStart(new Date()).toISOString();
    return (state?.outreach_emails ?? []).filter((e) => e.mailbox_id === mid && e.sent_at && e.sent_at >= since).length;
  };
  const boxes = (state?.mailboxes ?? []).filter((m) => m.status === "connected" && m.send_as_verified && (m.kind === "shared" || m.owner_id === me?.personId));
  const brokenBoxes = (state?.mailboxes ?? []).filter((m) => m.status === "connected" && !m.send_as_verified && (m.kind === "shared" || m.owner_id === me?.personId));
  useEffect(() => {
    if (!mailboxId && boxes.length) setMailboxId(boxes.find((m) => m.kind === "personal")?.id ?? boxes[0]!.id);
  }, [boxes, mailboxId]);
  const box = boxes.find((m) => m.id === mailboxId) ?? null;
  const viaGmail = !!(state?.gmail.configured && box);
  const left = box ? Math.max(0, DAILY_CAP - sentToday(box.id)) : null;

  const senderFor = useMemo((): Sender => {
    const first = box?.kind === "shared" ? (me?.firstName ?? "") : (box?.send_as_name ?? me?.name ?? "").split(" ")[0] || (me?.firstName ?? "");
    return { name: box?.send_as_name ?? me?.name ?? "", firstName: first, email: box?.send_as ?? me?.alias ?? "", phone: details.phone, bookingLink: details.bookingLink, business: details.business };
  }, [box, me, details]);

  const subjV = variants.find((v) => v.id === subjectId);
  const bodyV = variants.find((v) => v.id === bodyId);
  const sigV = variants.find((v) => v.id === sigId);
  const test = (state?.tests ?? []).find((t) => t.id === testId);

  const drafts = useMemo(() => {
    return prospects.map((p, i) => {
      const check = checkSendable(p);
      let sv = subjV;
      if (test && test.variable === "subject") {
        const pick = i % 2 === 0 ? test.variant_a_id : test.variant_b_id;
        sv = variants.find((v) => v.id === pick) ?? subjV;
      }
      const r = bodyV && sv ? renderEmail({ prospect: p, subject: sv.text, body: bodyV.text, signature: sigV?.text ?? null, sender: senderFor, opener }) : null;
      const e = edits[p.id];
      const subject = e?.subject ?? r?.subject ?? "";
      const body = e?.body ?? r?.body ?? "";
      return { p, check, sv, r, subject, body, edited: !!e };
    });
  }, [prospects, subjV, bodyV, sigV, test, variants, senderFor, opener, edits]);

  const sendable = drafts.filter((d) => !d.check.blocked);
  const unresolved = (d: (typeof drafts)[number]) => {
    const r = renderEmail({ prospect: d.p, subject: d.subject, body: d.body, sender: senderFor });
    return r.unresolved;
  };
  const withIssues = sendable.filter((d) => unresolved(d).length || !d.body.trimEnd().endsWith(OPT_OUT));
  const ready = sendable.filter((d) => !withIssues.includes(d));
  const overCap = viaGmail && left != null && ready.length > left;

  const itemsFor = (list: typeof ready) =>
    list.map((d) => ({
      prospect_id: d.p.id, subject: d.subject, body: d.body, subject_variant_id: d.sv?.id ?? null, body_variant_id: bodyV?.id ?? null,
      opener_used: d.r?.openerUsed ?? null, test_id: test?.id ?? null,
    }));

  const patchItem = useCallback((id: string, patch: Partial<QItem>) => setQueue((q) => (q ? q.map((x) => (x.id === id ? { ...x, ...patch } : x)) : q)), []);

  async function compose() {
    setBusy(true);
    setNote(null);
    try {
      const res = await act<{ emails: Row<"outreach_emails">[]; skipped: { prospect_id: string; reason: string }[] }>("outreach.compose", {
        items: itemsFor(ready), via: viaGmail ? "gmail" : "manual", mailbox_id: box?.id, from: box?.send_as ?? me?.alias,
      }, { reload: false });
      const nameOf = (id: string) => prospects.find((p) => p.id === id)?.name ?? "";
      setQueue(res.emails.map((e) => ({ id: e.id, prospectId: e.prospect_id, name: nameOf(e.prospect_id), to: e.to_address ?? "", subject: e.subject ?? "", body: e.body_rendered ?? "", status: "waiting" })));
      if (res.skipped.length) setNote(`${res.skipped.length} skipped: ${res.skipped.map((s) => `${nameOf(s.prospect_id)} (${s.reason})`).join("; ")}`);
      if (viaGmail) void run(res.emails.map((e) => e.id));
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not queue the emails");
    } finally {
      setBusy(false);
    }
  }

  async function run(ids: string[]) {
    if (ctl.current.running) return;
    ctl.current = { paused: false, cancelled: false, running: true };
    setPaused(false);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      while (ctl.current.paused && !ctl.current.cancelled) await sleep(400);
      if (ctl.current.cancelled) break;
      patchItem(id, { status: "sending" });
      let stop = false;
      try {
        const res = await fetch("/phase1/api/gmail/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email_id: id }) });
        const j = await res.json().catch(() => ({}));
        if (res.ok) patchItem(id, { status: "sent" });
        else {
          patchItem(id, { status: "failed", error: j.error ?? "Failed" });
          if (j.reconnect) setReconnect(true);
          if (j.reconnect || j.cap || j.alias === false) stop = true;
        }
      } catch {
        patchItem(id, { status: "failed", error: "Network error" });
      }
      if (stop) break;
      if (i < ids.length - 1) {
        let s = randomGapSeconds();
        while (s > 0 && !ctl.current.cancelled) {
          setCountdown(s);
          await sleep(1000);
          if (!ctl.current.paused) s--;
        }
        setCountdown(0);
      }
    }
    ctl.current.running = false;
    setCountdown(0);
    await reload();
  }

  async function cancel() {
    ctl.current.cancelled = true;
    const waiting = (queue ?? []).filter((q) => q.status === "waiting" || q.status === "sending");
    setQueue((q) => (q ? q.map((x) => (x.status === "waiting" ? { ...x, status: "cancelled" } : x)) : q));
    try {
      await act("outreach.cancel", { ids: waiting.filter((w) => w.status === "waiting").map((w) => w.id) });
    } catch {
      /* shown on reload */
    }
  }

  async function markSent(ids: string[]) {
    try {
      await act("outreach.markSent", { ids });
      ids.forEach((id) => patchItem(id, { status: "sent" }));
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not mark as sent");
    }
  }

  // Resume an earlier queue (tab closed part way).
  useEffect(() => {
    if (!resumeIds?.length || queue) return;
    const rows = (state?.outreach_emails ?? []).filter((e) => resumeIds.includes(e.id));
    setQueue(rows.map((e) => ({ id: e.id, prospectId: e.prospect_id, name: prospects.find((p) => p.id === e.prospect_id)?.name ?? (state?.prospects.find((p) => p.id === e.prospect_id)?.name ?? ""), to: e.to_address ?? "", subject: e.subject ?? "", body: e.body_rendered ?? "", status: "waiting" })));
    void run(rows.map((r) => r.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeIds]);

  const lbl = "block text-xs text-arepo-muted mb-1";
  const sel = (v: string, set: (s: string) => void, opts: { id: string; code: string; label: string | null; text: string }[], none?: string) => (
    <select value={v} onChange={(e) => set(e.target.value)} className={`${inputCls} w-full`}>
      {none !== undefined && <option value="">{none}</option>}
      {opts.map((o) => (
        <option key={o.id} value={o.id}>{o.code}: {(o.label ?? o.text).slice(0, 60)}</option>
      ))}
    </select>
  );

  const doneCount = (queue ?? []).filter((q) => q.status === "sent").length;
  const running = queue?.some((q) => q.status === "waiting" || q.status === "sending") && viaGmail;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/40 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Send emails">
      <div className="mx-auto max-w-4xl rounded-card border border-arepo-border bg-arepo-bg p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-arepo-ink">{queue ? "Sending" : `Send to ${prospects.length} selected`}</h2>
          <button className={btnCls} onClick={() => { if (!running) onClose(); }} disabled={!!running}>Close</button>
        </div>

        {!queue && (
          <>
            {!viaGmail && (
              <div className="mb-4">
                <Banner>
                  {state?.gmail.configured
                    ? brokenBoxes.length
                      ? `${brokenBoxes[0]!.send_as ?? brokenBoxes[0]!.address} is not set up in Gmail as a verified "Send mail as" address yet. Until it is, use "Open in mail app".`
                      : "No Gmail mailbox is connected yet. Connect one from the Prospects page, or use \"Open in mail app\"."
                    : "Gmail is not connected yet. Each email opens in your mail app, then you mark it as sent here."}
                </Banner>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <div><label className={lbl}>Subject</label>{sel(subjectId, setSubjectId, subjects)}</div>
              <div><label className={lbl}>Body</label>{sel(bodyId, setBodyId, bodies)}</div>
              <div><label className={lbl}>Signature</label>{sel(sigId, setSigId, sigs, "None (keep the draft's sign-off)")}</div>
              <div>
                <label className={lbl}>Split test (subject tests only)</label>
                <select value={testId} onChange={(e) => setTestId(e.target.value)} className={`${inputCls} w-full`}>
                  <option value="">No test</option>
                  {(state?.tests ?? []).filter((t) => t.variable === "subject").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Opening line</label>
                <select value={opener} onChange={(e) => setOpener(e.target.value as "specific" | "general")} className={`${inputCls} w-full`}>
                  <option value="specific">Personal line (falls back to general)</option>
                  <option value="general">General line</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Send from</label>
                <select value={mailboxId} onChange={(e) => setMailboxId(e.target.value)} className={`${inputCls} w-full`} disabled={!boxes.length}>
                  {boxes.length === 0 && <option value="">Mail app (no Gmail)</option>}
                  {boxes.map((m) => <option key={m.id} value={m.id}>{m.send_as} ({m.kind})</option>)}
                </select>
              </div>
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-arepo-ink2">Sender details used in the emails</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <input className={inputCls} placeholder="Phone number" value={details.phone} onChange={(e) => saveDetails({ ...details, phone: e.target.value })} />
                <input className={inputCls} placeholder="Booking link" value={details.bookingLink} onChange={(e) => saveDetails({ ...details, bookingLink: e.target.value })} />
                <input className={inputCls} placeholder="Business name" value={details.business} onChange={(e) => saveDetails({ ...details, business: e.target.value })} />
              </div>
              <p className="mt-1 text-xs text-arepo-muted">Kept in this browser only. Emails with an unfilled [placeholder] cannot be sent.</p>
            </details>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-arepo-ink2">
              <Pill tone="pos">{ready.length} ready</Pill>
              {withIssues.length > 0 && <Pill tone="warn">{withIssues.length} need editing</Pill>}
              {drafts.length - sendable.length > 0 && <Pill tone="neg">{drafts.length - sendable.length} blocked</Pill>}
              {viaGmail && left != null && <span>{left} of {DAILY_CAP} left today for {box?.send_as}</span>}
              {viaGmail && <span className="text-arepo-muted">one every {GAP_MIN_SECONDS} to {GAP_MAX_SECONDS} seconds</span>}
            </div>
            {overCap && <div className="mt-2"><Banner tone="warn">That is more than today&rsquo;s cap ({left} left). Untick some businesses.</Banner></div>}
            {note && <div className="mt-2"><Banner tone="bad">{note}</Banner></div>}

            <ul className="mt-4 space-y-2">
              {drafts.map((d) => {
                const un = d.check.blocked ? [] : unresolved(d);
                const isOpen = open === d.p.id;
                return (
                  <li key={d.p.id} className="rounded-control border border-arepo-border bg-white">
                    <button className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm" onClick={() => setOpen(isOpen ? null : d.p.id)}>
                      <span className="font-medium text-arepo-ink">{d.p.name}</span>
                      <span className="text-arepo-muted">{d.p.public_email ?? "no email"}</span>
                      {d.check.blocked && <Pill tone="neg">Blocked: {d.check.reasons.join(", ")}</Pill>}
                      {d.check.warnings.map((w) => <Pill key={w} tone="warn">{w}</Pill>)}
                      {un.length > 0 && <Pill tone="warn">Fill in {un.join(" ")}</Pill>}
                      {d.r?.warnings.map((w) => <Pill key={w} tone="warn">{w}</Pill>)}
                      {d.edited && <Pill>edited</Pill>}
                    </button>
                    {isOpen && !d.check.blocked && (
                      <div className="space-y-2 border-t border-arepo-border p-3">
                        <input className={`${inputCls} w-full`} value={d.subject} onChange={(e) => setEdits((x) => ({ ...x, [d.p.id]: { ...x[d.p.id], subject: e.target.value, body: x[d.p.id]?.body ?? d.body } }))} aria-label="Subject" />
                        <textarea className={`${inputCls} w-full font-mono text-[13px]`} rows={14} value={d.body} onChange={(e) => setEdits((x) => ({ ...x, [d.p.id]: { ...x[d.p.id], body: e.target.value, subject: x[d.p.id]?.subject ?? d.subject } }))} aria-label="Email text" />
                        {d.edited && <button className={btnCls} onClick={() => setEdits((x) => { const n = { ...x }; delete n[d.p.id]; return n; })}>Reset to the template</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className={btnPrimary} disabled={busy || !ready.length || overCap || !bodyV || !subjV} onClick={compose}>
                {viaGmail ? `Send ${ready.length} emails` : `Prepare ${ready.length} emails for the mail app`}
              </button>
            </div>
          </>
        )}

        {queue && (
          <>
            {reconnect && <div className="mb-3"><Banner tone="bad">Reconnect Gmail: Google asked to sign in again. <a className="underline" href="/phase1/api/gmail/connect">Reconnect</a>. The unsent emails stay queued.</Banner></div>}
            {note && <div className="mb-3"><Banner tone="warn">{note}</Banner></div>}
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-arepo-ink2">
              <span>{doneCount} of {queue.length} sent</span>
              {viaGmail && running && countdown > 0 && <span>next in {countdown}s{paused ? " (paused)" : ""}</span>}
              {viaGmail && running && (
                <>
                  <button className={btnCls} onClick={() => { ctl.current.paused = !ctl.current.paused; setPaused(ctl.current.paused); }}>{paused ? "Resume" : "Pause"}</button>
                  <button className={btnCls} onClick={cancel}>Cancel the rest</button>
                </>
              )}
              {!viaGmail && queue.some((q) => q.status === "waiting") && (
                <button className={btnPrimary} onClick={() => markSent(queue.filter((q) => q.status === "waiting").map((q) => q.id))}>Mark all as sent</button>
              )}
            </div>
            <ul className="space-y-2">
              {queue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-2 rounded-control border border-arepo-border bg-white px-3 py-2 text-sm">
                  <span className="font-medium text-arepo-ink">{q.name}</span>
                  <span className="text-arepo-muted">{q.to}</span>
                  <Pill tone={q.status === "sent" ? "pos" : q.status === "failed" ? "neg" : q.status === "cancelled" ? "neutral" : "warn"}>{q.status}</Pill>
                  {q.error && <span className="text-arepo-neg">{q.error}</span>}
                  {!viaGmail && q.status === "waiting" && (
                    <span className="ml-auto flex gap-2">
                      <a className={btnCls} href={mailtoLink(q.to, q.subject, q.body)}>Open in mail app</a>
                      <button className={btnCls} onClick={() => markSent([q.id])}>Mark as sent</button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!running && <div className="mt-4"><button className={btnPrimary} onClick={onClose}>Done</button></div>}
          </>
        )}
      </div>
    </div>
  );
}
