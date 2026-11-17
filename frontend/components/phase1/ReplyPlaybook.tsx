"use client";

import { useMemo, useState } from "react";
import { classifyAgainstPlaybook, fillReply, isOptOutEntry } from "@/lib/phase1/programme";
import type { Row } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { Pill, btnCls, btnPrimary, inputCls } from "./ui";

type Reply = Row<"replies">;

/** Replies that still need an answer: a real person wrote, and no prepared reply has gone yet. */
export const needsAnswer = (r: Reply): boolean => !r.reply_sent_at && r.reply_type !== "stop" && r.reply_type !== "bounce" && r.reply_type !== "auto";

/** Suggested category (cue match) with a manual override, the filled prepared reply, and one click to send it. Nothing sends by itself. */
export function PlaybookReply({ reply }: { reply: Reply }) {
  const { state, act, reload } = usePhase1();
  const playbook = useMemo(() => state?.programme.playbook ?? [], [state?.programme.playbook]);
  const prospect = state?.prospects.find((p) => p.id === reply.prospect_id);
  const pp = state?.programme.prospects.find((p) => p.prospect_id === reply.prospect_id);
  const suggested = useMemo(() => classifyAgainstPlaybook(`${reply.subject ?? ""}\n${reply.body_text ?? reply.snippet ?? ""}`, playbook, pp?.track_key ?? null), [reply, playbook, pp?.track_key]);
  const [cat, setCat] = useState<string>(reply.playbook_category ?? suggested?.category ?? "");
  const [edit, setEdit] = useState<{ subject: string; body: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!playbook.length) return null;

  const entry = playbook.find((e) => e.category === cat && (e.track_key === "all" || e.track_key === pp?.track_key)) ?? playbook.find((e) => e.category === cat);
  const first = (pp?.contact_name ?? prospect?.first_name ?? "").trim().split(/\s+/)[0] ?? "";
  const filled = entry ? fillReply(entry, { firstName: first, company: pp?.company ?? prospect?.name ?? "", senderFirstName: state?.me.firstName ?? "", subject: reply.subject }) : null;
  const subject = edit?.subject ?? filled?.subject ?? "";
  const body = edit?.body ?? filled?.body ?? "";
  const optOut = entry ? isOptOutEntry(entry) : false;
  const options = Array.from(new Set(playbook.map((e) => e.category)));

  async function send() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/phase1/api/programme/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reply_id: reply.id, subject, body, category: cat }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setNote(j.error ?? "Could not send");
      else await reload();
    } catch {
      setNote("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-control border border-arepo-border bg-arepo-surface2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-arepo-muted">Type of reply</span>
        <select className={`${inputCls} py-1`} value={cat} onChange={(e) => { setCat(e.target.value); setEdit(null); void act("reply.category", { id: reply.id, category: e.target.value }).catch((er) => setNote(String(er.message ?? er))); }}>
          <option value="">Not sorted</option>
          {options.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        </select>
        {suggested && !reply.playbook_category && <Pill tone="neutral">looks like {suggested.category.replace(/_/g, " ")}</Pill>}
        {reply.reply_sent_at && <Pill tone="pos">replied</Pill>}
      </div>
      {entry && !reply.reply_sent_at && optOut && <p className="mt-2 text-arepo-muted">This is an opt-out: the business is marked do not contact and nothing more is sent.</p>}
      {entry && !reply.reply_sent_at && !optOut && filled && (
        <div className="mt-2 space-y-2">
          {entry.retouch && <p className="text-arepo-warnText">This one needs a personal touch before it goes.</p>}
          <input className={`${inputCls} w-full`} value={subject} onChange={(e) => setEdit({ subject: e.target.value, body })} aria-label="Reply subject" />
          <textarea className={`${inputCls} w-full`} rows={6} value={body} onChange={(e) => setEdit({ subject, body: e.target.value })} aria-label="Reply text" />
          {filled.unresolved.length > 0 && !edit && <p className="text-arepo-neg">Fill in: {filled.unresolved.join(" ")}</p>}
          <div className="flex items-center gap-2">
            <button className={btnPrimary} disabled={busy || !body.trim()} onClick={send}>{busy ? "Sending..." : "Send reply"}</button>
            <span className="text-xs text-arepo-muted">Goes from your mailbox on this thread. Nothing sends until you click.</span>
          </div>
        </div>
      )}
      {note && <p className="mt-2 text-arepo-neg">{note}</p>}
      {!entry && <button className={`${btnCls} mt-2 py-1`} onClick={() => suggested && setCat(suggested.category)} disabled={!suggested}>Use the suggestion</button>}
    </div>
  );
}
