"use client";

import { computeCounts, followUpsDue, funnel, oneIn, replyRate, type Ratio } from "@/lib/phase1/metrics";
import { usePhase1 } from "./data";
import { METRIC_LABEL, metricValue, planCounts, planStartDate } from "./derived";
import { ProgrammeMetrics } from "./ProgrammeMetrics";
import { Loading, Pill, StatusBanners, Title } from "./ui";

const pct = (r: Ratio) => (r.rate == null ? "n/a" : `${(r.rate * 100).toFixed(r.rate < 0.1 ? 1 : 0)}%`);

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "pos" | "warn" }) {
  return (
    <div className="rounded-card border border-arepo-border bg-white p-4">
      <div className="text-sm text-arepo-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl ${tone === "pos" ? "text-arepo-pos" : tone === "warn" ? "text-arepo-warnText" : "text-arepo-ink"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-arepo-muted">{sub}</div>}
    </div>
  );
}

export function MetricsView() {
  const { state } = usePhase1();
  if (!state) return <Loading />;
  const now = new Date(state.now);
  const all = computeCounts(state.outreach_emails, state.replies, state.events, now);
  const plan = planCounts(state);
  const rr = replyRate(state.outreach_emails, state.replies, now);
  const f = funnel(all, state.prospects, state.events);
  const due = followUpsDue(state.outreach_emails, state.replies, state.prospects, now);
  const rates = state.plan_targets.filter((t) => t.scope === "rate");
  const target = (m: string) => rates.find((t) => t.metric === m)?.target;
  const tgt = (m: string) => { const v = target(m); return v == null ? undefined : `target ${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`; };
  const ok = (r: Ratio, m: string) => { const t = target(m); return r.rate == null || t == null ? undefined : r.rate >= t ? "pos" as const : "warn" as const; };
  const owners = state.people;
  const headline = state.plan_targets.filter((t) => t.scope === "headline" && t.period === "end_jan");

  return (
    <div>
      <Title title="Metrics" sub={`Counted from ${planStartDate().toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" })}, London time. Weeks start on Monday.`} />
      <StatusBanners gmail={false} />
      <ProgrammeMetrics />

      <h2 className="mb-2 font-display text-lg text-arepo-ink">Volume</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Emails out" value={String(all.emailsOut)} sub={`${all.emailsThisWeek} this week, ${all.emailsToday} today`} />
        <Tile label="Real replies" value={String(all.replies)} sub={`${all.positive} positive; ${all.bounces} bounces and ${all.autos} auto-replies not counted`} />
        <Tile label="Walk-ins" value={String(all.walkIns)} />
        <Tile label="Stops" value={String(all.stops)} sub="moved to do not contact" />
      </div>

      <h2 className="mb-2 font-display text-lg text-arepo-ink">Rates against the doc 06 targets</h2>
      <div className="mb-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Tile label="Reply rate" value={pct(rr)} tone={ok(rr, "reply_rate")} sub={`${rr.num} of ${rr.den} emails sent 5 or more working days ago; ${tgt("reply_rate") ?? ""}`} />
        <Tile label="Email to call" value={pct(f.emailToCall)} tone={ok(f.emailToCall, "email_to_call")} sub={`${oneIn(f.emailToCall)} (${f.emailToCall.num} of ${f.emailToCall.den}); ${tgt("email_to_call") ?? ""}`} />
        <Tile label="Walk-in to call" value={pct(f.walkInToCall)} tone={ok(f.walkInToCall, "walk_in_to_call")} sub={`${f.walkInToCall.num} of ${f.walkInToCall.den}; ${tgt("walk_in_to_call") ?? ""}`} />
        <Tile label="Discovery to proposal" value={pct(f.discoveryToProposal)} tone={ok(f.discoveryToProposal, "discovery_to_proposal")} sub={`${f.discoveryToProposal.num} of ${f.discoveryToProposal.den}; ${tgt("discovery_to_proposal") ?? ""}`} />
        <Tile label="Proposal to signed" value={pct(f.proposalToSigned)} tone={ok(f.proposalToSigned, "proposal_to_signed")} sub={`${f.proposalToSigned.num} of ${f.proposalToSigned.den}; ${tgt("proposal_to_signed") ?? ""}`} />
        <Tile label="Follow-ups due" value={String(due.length)} sub="sent 4 or more working days ago, no reply, no follow-up yet" tone={due.length ? "warn" : undefined} />
      </div>
      <p className="mb-6 text-xs text-arepo-muted">Formulas: reply rate counts only emails sent at least 5 working days ago and excludes bounces and auto-replies. Email to call excludes calls that came from walk-ins.</p>

      <h2 className="mb-2 font-display text-lg text-arepo-ink">Progress to the end of January</h2>
      <div className="mb-6 overflow-x-auto rounded-card border border-arepo-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted"><tr><th className="px-3 py-2">Measure</th><th className="px-3 py-2">So far</th><th className="px-3 py-2">Target</th></tr></thead>
          <tbody>
            {["emails", "walk_ins", "discoveries", "proposals", "paid"].map((m) => (
              <tr key={m} className="border-t border-arepo-border"><td className="px-3 py-2">{METRIC_LABEL[m]}</td><td className="px-3 py-2">{metricValue(plan, m)}</td><td className="px-3 py-2">{headline.find((t) => t.metric === m)?.target ?? "n/a"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 font-display text-lg text-arepo-ink">By person</h2>
      <div className="mb-6 overflow-x-auto rounded-card border border-arepo-border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted"><tr><th className="px-3 py-2">Person</th><th className="px-3 py-2">Emails out</th><th className="px-3 py-2">Replies</th><th className="px-3 py-2">Walk-ins</th></tr></thead>
          <tbody>
            {owners.map((p) => {
              const em = state.outreach_emails.filter((e) => e.owner_id === p.id);
              const ids = new Set(state.prospects.filter((x) => x.owner_id === p.id).map((x) => x.id));
              const c = computeCounts(em, state.replies.filter((r) => r.prospect_id && ids.has(r.prospect_id)), state.events.filter((e) => e.owner_id === p.id), now);
              return <tr key={p.id} className="border-t border-arepo-border"><td className="px-3 py-2">{p.name ?? p.email}</td><td className="px-3 py-2">{c.emailsOut}</td><td className="px-3 py-2">{c.replies}</td><td className="px-3 py-2">{c.walkIns}</td></tr>;
            })}
          </tbody>
        </table>
      </div>

      {due.length > 0 && (
        <>
          <h2 className="mb-2 font-display text-lg text-arepo-ink">Follow-ups due <Pill tone="warn">{due.length}</Pill></h2>
          <ul className="space-y-1 text-sm">
            {due.slice(0, 30).map((e) => <li key={e.id} className="rounded-control border border-arepo-border bg-white px-3 py-2">{state.prospects.find((p) => p.id === e.prospect_id)?.name ?? e.prospect_id}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}
