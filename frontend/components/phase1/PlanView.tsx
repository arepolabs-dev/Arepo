"use client";

import { BLOCKED_STATUSES, messageVoice, senderKey, slug, variantKeys, variantText } from "@/lib/phase1/programme";
import type { ProgrammeProspect } from "@/lib/phase1/types";
import { usePhase1 } from "./data";
import { Loading, Pill, Title } from "./ui";

/** "Wed 18 Nov" from "2026-11-18". */
function fmtDay(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const d = new Date(`${ymd}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? ymd : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(d);
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Static background per person: the parts that do not live in the database. */
const ABOUT: Record<string, { route: string; why: string }> = {
  dayyan: {
    route: "Startups. Dayyan writes as Arepo Labs to small teams, ideally to a named person on their own website.",
    why: "Small startups have little time and no spare person for repetitive admin and marketing jobs, so a short, specific note about one thing we saw on their site has a fair chance of being read.",
  },
  jack: {
    route: "Local trades and shops. Jack writes as himself, a neighbour, with a more local and personal route.",
    why: "Owner-run businesses nearby read their own inbox, and a neighbour writing plainly, with no flattery and one clear ask, is easy to answer.",
  },
};

function reasonFor(p: ProgrammeProspect): string {
  const what = (p.what_they_do ?? "").trim();
  const bits = [what && !/^see\b/i.test(what) ? what : "", p.hook ?? "", p.segment ?? ""].map((x) => x.trim()).filter(Boolean);
  return bits[0] ?? "Picked from the list for this track.";
}

/** The Plan page: one section per person, built from the live phases and prospects so it stays true as new waves load. */
export function PlanView() {
  const { state } = usePhase1();
  const prog = state?.programme;
  if (!state || !prog) return <Loading />;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const people: string[] = [];
  for (const t of prog.tracks) {
    const k = senderKey(t.sender);
    if (k && !people.includes(k)) people.push(k);
  }

  return (
    <div className="max-w-reading space-y-8">
      <Title title="Plan" sub="What goes out, when, and why these people. Each person has their own route." />
      {people.length === 0 && <p className="text-sm text-arepo-muted">No programme is loaded yet.</p>}
      {people.map((k) => {
        const tracks = prog.tracks.filter((t) => senderKey(t.sender) === k);
        const tk = tracks.map((t) => slug(t.key));
        const mine = prog.prospects.filter((p) => tk.includes(slug(p.track_key)));
        const phases = prog.phases.filter((p) => tk.includes(slug(p.track_key))).sort((a, b) => a.ord - b.ord);
        const msgs = prog.messages.filter((m) => {
          const p = mine.find((x) => x.ext_id === m.prospect_ext_id);
          return !!p && messageVoice(m, p, prog.tracks) === k && !!m.send_on;
        });
        const firstDay = msgs.filter((m) => m.step === "first" && m.status === "pending").map((m) => m.send_on!).sort()[0];
        const followDays = Array.from(new Set(msgs.filter((m) => m.step !== "first" && m.status === "pending").map((m) => m.send_on!))).sort();
        const about = ABOUT[k];
        const name = (state.people.find((p) => senderKey(p.name ?? p.email) === k)?.name ?? cap(k)).split(/\s+/)[0]!;
        return (
          <section key={k} aria-label={`${name}'s plan`} className="space-y-4">
            <h2 className="font-display text-xl text-arepo-ink">{name}: {tracks.map((t) => t.name).join(", ")}</h2>
            {about && <p className="text-sm text-arepo-ink2">{about.route}</p>}

            <div className="rounded-card border border-arepo-border bg-white p-4 text-sm">
              <h3 className="font-medium text-arepo-ink">Timeline</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-arepo-ink2">
                <li>{firstDay ? <>Wave 1 first emails go {firstDay <= today ? "now (due" : "on"} {fmtDay(firstDay)}{firstDay <= today ? ")" : ""}.</> : "Wave 1 first emails go out once the phase is active."}</li>
                <li>After that we wait 3 days for replies before judging or changing anything.</li>
                <li>Follow-ups go on the dates saved with each email, about 7 and 14 days after the first{followDays.length ? ` (next: ${followDays.slice(0, 3).map(fmtDay).join(", ")})` : ""}.</li>
                <li>Anyone who replies, opts out or bounces gets no more emails.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-arepo-ink">What each phase tests</h3>
              {phases.length === 0 && <p className="text-sm text-arepo-muted">No phases yet.</p>}
              {phases.map((ph) => {
                const keys = variantKeys(ph);
                const v = (ph.variants ?? {}) as Record<string, unknown>;
                const people_ = mine.filter((p) => p.phase_id === ph.phase_id && p.status !== "skipped");
                return (
                  <article key={ph.phase_id} className="rounded-card border border-arepo-border bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-arepo-ink">{ph.phase_id}: {ph.variable ?? "Phase"}</span>
                      <Pill tone={ph.status === "judged" ? "pos" : ph.status === "active" ? "warn" : "neutral"}>{ph.status}</Pill>
                      {ph.judge_on && <span className="text-arepo-muted">judged {fmtDay(ph.judge_on)}</span>}
                    </div>
                    {keys.length > 0 && <p className="mt-1 text-arepo-ink2">{keys.map((x, i) => <span key={x}>{i > 0 ? " vs " : ""}<span className="font-medium">{x}:</span> {variantText(v[x])}</span>)}</p>}
                    <p className="mt-1 text-arepo-ink2">
                      {ph.hypothesis ? `${ph.hypothesis} ` : ""}Only this one thing changes between the versions, so any difference in replies points to it.
                    </p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-arepo-muted">Why these {people_.length} recipients</summary>
                      <ul className="mt-2 space-y-1">
                        {people_.map((p) => (
                          <li key={p.ext_id} className={BLOCKED_STATUSES.has(p.status) && p.status !== "new" ? "text-arepo-muted" : "text-arepo-ink2"}>
                            <span className="font-medium">{p.company}</span>: {reasonFor(p)}
                          </li>
                        ))}
                        {people_.length === 0 && <li className="text-arepo-muted">No one in this phase yet.</li>}
                      </ul>
                    </details>
                  </article>
                );
              })}
            </div>

            {about && <p className="rounded-control bg-arepo-surface2 p-3 text-sm text-arepo-ink2"><span className="font-medium">Why this route:</span> {about.why} A good result is a booked call, and one wave is a small sample, so we read the results as a lean and not as proof.</p>}
          </section>
        );
      })}
    </div>
  );
}
