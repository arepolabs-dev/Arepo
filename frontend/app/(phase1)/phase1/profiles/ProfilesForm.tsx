"use client";

import { useState } from "react";
import type { Person } from "@/lib/site/profiles";

const input = "mt-1 w-full rounded-control border border-arepo-border bg-white px-3 py-2 text-sm text-arepo-ink";
const label = "block text-sm text-arepo-ink2";

export function ProfilesForm({ slug, initial }: { slug: "dayyan" | "jack"; initial: Person }) {
  const [v, setV] = useState({
    name: initial.name, role: initial.role, bio: initial.bio, proof: initial.proof,
    email: initial.email, calendly: initial.calendly, photo_url: initial.photo,
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let photo = v.photo_url;
      if (file) {
        const fd = new FormData();
        fd.set("slug", slug);
        fd.set("file", file);
        const up = await fetch("/phase1/api/profiles/photo", { method: "POST", body: fd });
        const j = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(j.error ?? "Photo upload failed");
        photo = j.url;
      }
      const res = await fetch("/phase1/api/profiles", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, ...v, photo_url: photo }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not save");
      setV((s) => ({ ...s, photo_url: photo }));
      setFile(null);
      setMsg({ ok: true, text: "Saved. The public page updates within a minute." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save" });
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? v.photo_url;
  return (
    <form onSubmit={save} className="rounded-card border border-arepo-border bg-white p-5" aria-label={`${slug} profile`}>
      <div className="flex items-center gap-4">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-control bg-arepo-surface2">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-end p-2 font-display text-2xl text-arepo-borderStrong">{initial.initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <label htmlFor={`${slug}-photo`} className={label}>Photo (JPG, PNG or WebP, up to 5 MB)</label>
          <input id={`${slug}-photo`} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="mt-1 block w-full text-sm" />
        </div>
      </div>
      {([
        ["name", "Name"], ["role", "Role"], ["bio", "Degree line"], ["email", "Email"], ["calendly", "Book a chat link"],
      ] as const).map(([k, l]) => (
        <div key={k} className="mt-4">
          <label htmlFor={`${slug}-${k}`} className={label}>{l}</label>
          <input id={`${slug}-${k}`} value={v[k]} onChange={set(k)} className={input} type={k === "email" ? "email" : "text"} />
        </div>
      ))}
      <div className="mt-4">
        <label htmlFor={`${slug}-proof`} className={label}>About them</label>
        <textarea id={`${slug}-proof`} value={v.proof} onChange={set("proof")} rows={5} className={input} />
      </div>
      <button type="submit" disabled={busy} className="mt-4 rounded-control bg-arepo-ink px-4 py-2.5 text-sm font-medium text-white hover:bg-arepo-ink2 disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
      {msg && (
        <p role="status" className={`mt-3 text-sm ${msg.ok ? "text-arepo-ink2" : "text-arepo-accent"}`}>{msg.text}</p>
      )}
    </form>
  );
}
