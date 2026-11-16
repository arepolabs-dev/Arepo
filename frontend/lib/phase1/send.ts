/** Sending limits. Change these two numbers to change the pace. */
export const DAILY_CAP = 20;
/** Random gap between two sends in a batch, in seconds. */
export const GAP_MIN_SECONDS = 60;
export const GAP_MAX_SECONDS = 120;

export function randomGapSeconds(rand: () => number = Math.random): number {
  return Math.round(GAP_MIN_SECONDS + rand() * (GAP_MAX_SECONDS - GAP_MIN_SECONDS));
}

export function remainingToday(sentToday: number, cap = DAILY_CAP): number {
  return Math.max(0, cap - sentToday);
}
