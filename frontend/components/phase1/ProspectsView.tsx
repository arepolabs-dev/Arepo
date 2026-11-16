"use client";

import { useMemo, useRef, useState } from "react";
import { PROSPECT_COLUMNS, toCsv } from "@/lib/phase1/csv";
import { checkSendable } from "@/lib/phase1/rules";
import { STAGE_LABELS } from "@/lib/phase1/pipeline";
import type { Row } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { SendPanel } from "./SendPanel";
import { Banner, Loading, Pill, StatusBanners, Title, btnCls, btnPrimary, inputCls } from "./ui";

type P = Row<"prospects">;
type Col = { key: string; label: string; edit?: "text" | "select" | "bool"; options?: string[]; wide?: boolean };

const AREAS = ["W12/W6", "W3-W7", "W10/W11/NW10", "NW10/NW6"];
const TIERS = ["A", "B", "C"];
const TYPES = ["ltd", "llp", "sole_trader", "partnership", "unknown"];
const CHANNELS = ["email", "walk_in", "warm", "online"];
const STATUS = Object.keys(STAGE_LABELS);

export function ProspectsView() {
  const { state, act, reload } = usePhase1();
  const [q, setQ] = useState("");
  const [f, setF] = useState({ area: "", tier: "", owner: "", status: "", type: "", email: "" });
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resume, setResume] = useState<string[] | undefined>();
  const file = useRef<HTMLInputElement>(null);

  const people = state?.people ?? [];
  const ownerName = (id: string | null) => {
    const p = people.find((x) => x.id === id);
    return p ? (p.name ?? p.email).split(" ")[0]! : "";
  };
  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const gmailNote = params?.get("gmail");

  const COLS: Col[] = [
    { key: "name", label: "Business", edit: "text", wide: true },
    { key: "status", label: "Status", edit: "select", options: STATUS },
    { key: "tier", label: "Tier", edit: "select", options: TIERS },
    { key: "area", label: "Area", edit: "select", options: AREAS },
    { key: "owner_id", label: "Owner", edit: "select", options: people.map((p) => p.id) },
    { key: "company_type", label: "Company type", edit: "select", options: TYPES },
    { key: "public_email", label: "Email", edit: "text", wide: true },
    { key: "email_found", label: "Email found", edit: "bool" },
    { key: "first_name", label: "First name", edit: "text" },
    { key: "channel", label: "Channel", edit: "select", options: CHANNELS },
    { key: "vertical", label: "Vertical", edit: "text" },
    { key: "trade_or_type", label: "Trade or type", edit: "text" },
    { key: "postcode", label: "Postcode", edit: "text" },
    { key: "website", label: "Website", edit: "text" },
    { key: "maps_url", label: "Maps" },
    { key: "phone_public", label: "Phone (public)", edit: "text" },
    { key: "source_doc", label: "Source" },
    { key: "opener_general", label: "Opener (general)", edit: "text", wide: true },
    { key: "opener_specific", label: "Opener (specific)", edit: "text", wide: true },
    { key: "subject_hint", label: "Subject hint", edit: "text" },
    { key: "why_fit", label: "Why a fit", edit: "text", wide: true },
    { key: "suggested_angle", label: "Suggested angle", edit: "text", wide: true },
    { key: "batch_id", label: "Batch" },
  ];

  const rows = useMemo(() => {
    const all = state?.prospects ?? [];
    const needle = q.trim().toLowerCase();
    const out = all.filter((p) => {
      if (f.area && p.area !== f.area) return false;
      if (f.tier && p.tier !== f.tier) return false;
      if (f.owner && p.owner_id !== f.owner) return false;
      if (f.status && p.status !== f.status) return false;
      if (f.type && p.company_type !== f.type) return false;
      if (f.email === "yes" && !p.public_email) return false;
      if (f.email === "no" && p.public_email) return false;
      if (needle && !`${p.name} ${p.trade_or_type ?? ""} ${p.vertical ?? ""} ${p.postcode ?? ""} ${p.public_email ?? ""} ${p.why_fit ?? ""} ${p.notes ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const k = sort.key as keyof P;
    const val = (p: P) => (k === "owner_id" ? ownerName(p.owner_id) : ((p[k] as string | boolean | null) ?? ""));
    return [...out].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.prospects, q, f, sort, people]);

  if (!state) return <Loading />;

  const pending = state.outreach_emails.filter((e) => e.status === "composed" && e.sent_via === "gmail" && e.owner_id === state.me.personId);
  const selected = rows.filter((p) => sel.has(p.id));
  const allTicked = rows.length > 0 && rows.every((p) => sel.has(p.id));
  const toggleAll = () => setSel(allTicked ? new Set() : new Set(rows.map((p) => p.id)));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function save(p: P, key: string, value: unknown) {
    setEditing(null);
    const cur = (p as unknown as Record<string, unknown>)[key];
    if ((cur ?? "") === (value ?? "")) return;
    try {
      await act("prospect.update", { id: p.id, patch: { [key]: value } });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not save");
    }
  }

  function exportCsv() {
    const data = rows.map((p) => ({ ...p, owner: ownerName(p.owner_id).toLowerCase(), batch: p.batch_id ?? "" }) as unknown as Record<string, unknown>);
    const blob = new Blob([toCsv(PROSPECT_COLUMNS, data)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importCsv(file: File) {
    try {
      const r = await act<{ added: number; skipped: number }>("prospect.import", { csv: await file.text() });
      setMsg(`Imported ${r.added} new, skipped ${r.skipped} that were already there or had no name.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function addOne() {
    const name = window.prompt("Business name");
    if (!name?.trim()) return;
    try {
      await act("prospect.create", { row: { name } });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not add");
    }
  }

  const gmailMsg: Record<string, string> = {
    connected: "Gmail connected.",
    alias_missing: "Gmail connected, but the arepolabs address is not set up as a verified \"Send mail as\" address in that Gmail yet. Sends stay off until it is.",
    cancelled: "Gmail sign-in was cancelled or expired. Try again.",
    no_refresh_token: "Google did not give a long-lived token. Remove Arepo from the Google account's third-party access and connect again.",
    not_configured: "Gmail is not configured on this server yet.",
  };

  function cell(p: P, c: Col) {
    const raw = (p as unknown as Record<string, unknown>)[c.key];
    const isEditing = editing?.id === p.id && editing.key === c.key;
    if (c.key === "owner_id") {
      if (!isEditing) return <span onClick={() => setEditing({ id: p.id, key: c.key })} className="cursor-pointer">{ownerName(p.owner_id) || <span className="text-arepo-muted">none</span>}</span>;
      return (
        <select autoFocus defaultValue={p.owner_id ?? ""} className={inputCls} onChange={(e) => save(p, c.key, e.target.value || null)} onBlur={() => setEditing(null)}>
          <option value="">none</option>
          {people.map((x) => <option key={x.id} value={x.id}>{(x.name ?? x.email).split(" ")[0]}</option>)}
        </select>
      );
    }
    if (c.edit === "bool") return <input type="checkbox" checked={!!raw} onChange={(e) => save(p, c.key, e.target.checked)} aria-label={c.label} />;
    if (c.key === "website" || c.key === "maps_url") {
      const href = raw ? String(raw) : "";
      if (!isEditing) return href ? <a className="underline" target="_blank" rel="noreferrer" href={href}>{c.key === "maps_url" ? "map" : href.replace(/^https?:\/\/(www\.)?/, "").slice(0, 28)}</a> : <span className="text-arepo-muted">{c.edit ? <span className="cursor-pointer" onClick={() => setEditing({ id: p.id, key: c.key })}>add</span> : ""}</span>;
    }
    if (!c.edit) return <span className="text-arepo-ink2">{raw == null ? "" : String(raw).slice(0, 40)}</span>;
    if (!isEditing) {
      const shown = c.key === "status" ? STAGE_LABELS[p.status] : raw == null || raw === "" ? "" : String(raw);
      return (
        <span onClick={() => setEditing({ id: p.id, key: c.key })} title={shown} className={`block cursor-pointer ${c.wide ? "max-w-[18rem] truncate" : "max-w-[10rem] truncate"} ${shown ? "" : "text-arepo-muted"}`}>
          {shown || "add"}
        </span>
      );
    }
    if (c.edit === "select") {
      return (
        <select autoFocus defaultValue={String(raw ?? "")} className={inputCls} onChange={(e) => save(p, c.key, e.target.value || null)} onBlur={() => setEditing(null)}>
          {c.key !== "status" && c.key !== "company_type" && <option value="">none</option>}
          {c.options!.map((o) => <option key={o} value={o}>{c.key === "status" ? STAGE_LABELS[o as keyof typeof STAGE_LABELS] : o}</option>)}
        </select>
      );
    }
    return (
      <input autoFocus defaultValue={String(raw ?? "")} className={`${inputCls} w-full min-w-[10rem]`}
        onBlur={(e) => save(p, c.key, e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(null); }} />
    );
  }

  const myBoxes = state.mailboxes.filter((m) => m.kind === "personal" && m.owner_id === state.me.personId);
  const shared = state.mailboxes.find((m) => m.kind === "shared");
  const sel1 = `${inputCls} py-1.5`;

  return (
    <div>
      <Title title="Prospects" sub={`${rows.length} of ${state.prospects.length} shown, ${selected.length} ticked`}>
        <button className={btnCls} onClick={addOne}>Add business</button>
        <button className={btnCls} onClick={() => file.current?.click()}>Import CSV</button>
        <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) void importCsv(x); e.target.value = ""; }} />
        <button className={btnCls} onClick={exportCsv}>Export CSV</button>
        <button className={btnPrimary} disabled={!selected.length} onClick={() => setSending(true)}>Send {selected.length} emails</button>
      </Title>
      <StatusBanners />
      <div className="mb-4 space-y-2">
        {gmailNote && gmailMsg[gmailNote] && <Banner tone={gmailNote === "connected" ? "info" : "warn"}>{gmailMsg[gmailNote]}</Banner>}
        {msg && <Banner>{msg}</Banner>}
        {pending.length > 0 && !sending && (
          <Banner tone="warn">
            {pending.length} email{pending.length === 1 ? " is" : "s are"} queued from an earlier batch.{" "}
            <button className="underline" onClick={() => { setResume(pending.map((e) => e.id)); setSending(true); }}>Resume sending</button>{" or "}
            <button className="underline" onClick={async () => { await act("outreach.cancel", { ids: pending.map((e) => e.id) }); }}>discard them</button>.
          </Banner>
        )}
        {state.gmail.configured && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-arepo-ink2">
            <span>Gmail:</span>
            {myBoxes.length ? myBoxes.map((m) => <Pill key={m.id} tone={m.status === "connected" && m.send_as_verified ? "pos" : "warn"}>{m.address} sends as {m.send_as}{m.send_as_verified ? "" : " (alias not set up in Gmail)"}</Pill>) : <a className={btnCls} href="/phase1/api/gmail/connect?kind=personal">Connect my Gmail</a>}
            {shared ? <Pill tone={shared.status === "connected" && shared.send_as_verified ? "pos" : "warn"}>shared {shared.address}</Pill> : <a className={btnCls} href="/phase1/api/gmail/connect?kind=shared">Connect shared enquiries Gmail</a>}
            {myBoxes.length > 0 && <a className="underline" href="/phase1/api/gmail/connect?kind=personal">Reconnect</a>}
          </div>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input className={`${sel1} w-56`} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className={sel1} value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} aria-label="Area"><option value="">All areas</option>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select className={sel1} value={f.tier} onChange={(e) => setF({ ...f, tier: e.target.value })} aria-label="Tier"><option value="">All tiers</option>{TIERS.map((a) => <option key={a}>{a}</option>)}</select>
        <select className={sel1} value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} aria-label="Owner"><option value="">Any owner</option>{people.map((p) => <option key={p.id} value={p.id}>{(p.name ?? p.email).split(" ")[0]}</option>)}</select>
        <select className={sel1} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="">Any status</option>{STATUS.map((s) => <option key={s} value={s}>{STAGE_LABELS[s as keyof typeof STAGE_LABELS]}</option>)}</select>
        <select className={sel1} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Company type"><option value="">Any company type</option>{TYPES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className={sel1} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="Email found"><option value="">Email: any</option><option value="yes">Has email</option><option value="no">No email</option></select>
        {(q || Object.values(f).some(Boolean)) && <button className={btnCls} onClick={() => { setQ(""); setF({ area: "", tier: "", owner: "", status: "", type: "", email: "" }); }}>Clear</button>}
      </div>

      <div className="overflow-x-auto rounded-card border border-arepo-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-arepo-surface2 px-3 py-2"><input type="checkbox" checked={allTicked} onChange={toggleAll} aria-label="Select all shown" /></th>
              {COLS.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                  <button onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
                    {c.label}{sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2 font-medium">Can send?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const chk = checkSendable(p);
              return (
                <tr key={p.id} className={`border-t border-arepo-border align-top ${sel.has(p.id) ? "bg-arepo-accentTint/40" : ""}`}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2"><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                  {COLS.map((c) => <td key={c.key} className="px-3 py-2">{cell(p, c)}</td>)}
                  <td className="whitespace-nowrap px-3 py-2">
                    {chk.blocked ? <Pill tone="neg">{chk.reasons.join(", ")}</Pill> : <Pill tone="pos">Yes</Pill>}{" "}
                    {chk.warnings.includes("Check Companies House") && (
                      <>
                        <Pill tone="warn">Check Companies House</Pill>{" "}
                        <button className="text-xs underline" onClick={() => save(p, "company_type", "ltd")}>Mark checked: Ltd</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={COLS.length + 2} className="px-3 py-6 text-center text-arepo-muted">No businesses match. {state.prospects.length === 0 ? "The list is empty: apply the seed or import a CSV." : ""}</td></tr>}
          </tbody>
        </table>
      </div>

      {sending && (
        <SendPanel prospects={resume ? (state.prospects.filter((p) => state.outreach_emails.some((e) => resume.includes(e.id) && e.prospect_id === p.id))) : selected} resumeIds={resume}
          onClose={() => { setSending(false); setResume(undefined); setSel(new Set()); void reload(); }} />
      )}
    </div>
  );
}
