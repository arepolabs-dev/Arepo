import type { Phase1State } from "@/lib/phase1/state";
import { PLAN_START, computeCounts, londonMidnight, type Counts } from "@/lib/phase1/metrics";

export function planStartDate(): Date {
  const [y, m, d] = PLAN_START.split("-").map(Number) as [number, number, number];
  return londonMidnight(y, m, d);
}

/** Totals since the plan started (cumulative, as the targets are). */
export function planCounts(s: Phase1State): Counts {
  return computeCounts(s.outreach_emails, s.replies, s.events, new Date(s.now), planStartDate());
}

/** Counts a plan_targets metric name maps to; null when the dashboard does not track it. */
export function metricValue(c: Counts, metric: string): number | null {
  switch (metric) {
    case "emails": return c.emailsOut;
    case "walk_ins": return c.walkIns;
    case "discoveries": return c.discoveries;
    case "proposals": return c.proposals;
    case "paid": return c.won;
    default: return null;
  }
}

export const METRIC_LABEL: Record<string, string> = {
  emails: "Emails sent", walk_ins: "Walk-ins", discoveries: "Discovery calls", proposals: "Proposals sent", paid: "Paid clients", warm_chats: "Warm chats",
};
