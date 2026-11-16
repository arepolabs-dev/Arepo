"use client";

import Link from "next/link";
import { planWeek } from "@/lib/phase1/metrics";
import { usePhase1 } from "./data";
import { METRIC_LABEL, metricValue, planCounts } from "./derived";
import { Loading, Pill, StatusBanners, Title } from "./ui";

const WEEKS = [
  { n: 1, dates: "16 to 22 Nov", title: "Stage 1: warm-up", body: "5 emails with subject A, 4 walk-ins, 1 discovery call, 3 warm chats." },
  { n: 2, dates: "23 to 29 Nov", title: "Stage 2: same subject, 20 more", body: "20 emails with the same subject (25 in total), 8 walk-ins in total, 1 to 2 discoveries." },
  { n: 3, dates: "30 Nov to 6 Dec", title: "Stage 3: two subjects", body: "2 batches of 20 with two subjects (65 emails in total), 2 discoveries, 1 proposal." },
  { n: 4, dates: "7 to 13 Dec", title: "Stage 4: scale the winner", body: "Send the winning variant (165 emails in total), 3 discoveries, 2 proposals, 1 paid client." },
];

const CHECKPOINTS = [
  { when: "Mon 7 Dec", what: "Go or no-go: at least 2 discoveries and at least 1 proposal sent." },
  { when: "Fri 19 Dec", what: "Mid-way review against the headline targets." },
  { when: "Sat 31 Jan", what: "End-of-January targets: 60 emails, 15 walk-ins, 5 discoveries, 4 proposals, 1 paid." },
];

function Bar({ value, target }: { value: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-arepo-surface2" aria-hidden>
      <div className="h-1.5 rounded-full bg-arepo-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PlanView() {
  const { state } = usePhase1();
  if (!state) return <Loading />;
  const now = new Date(state.now);
  const week = planWeek(now);
  const c = planCounts(state);
  const wk = week >= 1 && week <= 4 ? week : week === 0 ? 1 : 4;
  const targets = state.plan_targets.filter((t) => t.scope === "week" && t.period === `w${wk}`);
  const headline = state.plan_targets.filter((t) => t.scope === "headline");
  const periods = Array.from(new Set(headline.map((t) => t.period)));
  const due = state.prospects.filter((p) => p.status === "contacted").length;

  return (
    <div>
      <Title title="Plan" sub={week === 0 ? "The plan starts Monday 16 November." : week === 5 ? "The 4 weeks are over: see the headline targets." : `Week ${week} of 4`} />
      <StatusBanners />

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-arepo-ink">This week&rsquo;s targets (running totals since 16 Nov)</h2>
        {targets.length === 0 ? (
          <p className="text-sm text-arepo-muted">No targets loaded yet. They come with the seed file.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {targets.map((t) => {
              const v = metricValue(c, t.metric);
              return (
                <div key={t.id} className="rounded-card border border-arepo-border bg-white p-4">
                  <div className="text-sm text-arepo-muted">{METRIC_LABEL[t.metric] ?? t.metric}</div>
                  <div className="mt-1 font-display text-2xl text-arepo-ink">{v == null ? "n/a" : v} <span className="text-base text-arepo-muted">of {t.target}</span></div>
                  {v != null && <div className="mt-2"><Bar value={v} target={t.target} /></div>}
                  {t.note && <div className="mt-2 text-xs text-arepo-muted">{t.note}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link href="/phase1/prospects" className="rounded-card border border-arepo-border bg-white p-4 hover:bg-arepo-surface2">
          <div className="text-sm text-arepo-muted">Emails out today</div>
          <div className="font-display text-2xl text-arepo-ink">{c.emailsToday}</div>
        </Link>
        <Link href="/phase1/replies" className="rounded-card border border-arepo-border bg-white p-4 hover:bg-arepo-surface2">
          <div className="text-sm text-arepo-muted">Replies (real) / positive</div>
          <div className="font-display text-2xl text-arepo-ink">{c.replies} / {c.positive}</div>
        </Link>
        <Link href="/phase1/pipeline" className="rounded-card border border-arepo-border bg-white p-4 hover:bg-arepo-surface2">
          <div className="text-sm text-arepo-muted">Waiting for a reply</div>
          <div className="font-display text-2xl text-arepo-ink">{due}</div>
        </Link>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-arepo-ink">The 4 weeks</h2>
        <ol className="space-y-3">
          {WEEKS.map((w) => (
            <li key={w.n} className={`rounded-card border p-4 ${w.n === week ? "border-arepo-ink bg-white" : "border-arepo-border bg-white"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-arepo-ink">Week {w.n}: {w.title}</span>
                <span className="text-sm text-arepo-muted">{w.dates}</span>
                {w.n === week && <Pill tone="pos">This week</Pill>}
              </div>
              <p className="mt-1 text-sm text-arepo-ink2">{w.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg text-arepo-ink">Checkpoints</h2>
        <ul className="space-y-2 text-sm">
          {CHECKPOINTS.map((k) => (
            <li key={k.when} className="rounded-control border border-arepo-border bg-white px-4 py-3"><span className="font-medium text-arepo-ink">{k.when}.</span> <span className="text-arepo-ink2">{k.what}</span></li>
          ))}
        </ul>
        {periods.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-card border border-arepo-border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-arepo-surface2 text-left text-xs text-arepo-muted"><tr><th className="px-3 py-2">Headline target</th>{periods.map((p) => <th key={p} className="px-3 py-2">{p === "wk2" ? "End of week 2" : p === "wk4" ? "End of week 4" : "End of January"}</th>)}</tr></thead>
              <tbody>
                {["emails", "walk_ins", "discoveries", "proposals", "paid"].map((m) => (
                  <tr key={m} className="border-t border-arepo-border">
                    <td className="px-3 py-2 text-arepo-ink2">{METRIC_LABEL[m]} (now {metricValue(c, m)})</td>
                    {periods.map((p) => <td key={p} className="px-3 py-2">{headline.find((t) => t.period === p && t.metric === m)?.target ?? ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
