import { PM } from "./paths";

/**
 * Post-sign-in destination from a `?next=` parameter. Only same-site absolute paths inside the Arepo
 * site ("/predictionmarket/lab") are accepted, never protocol-relative ("//evil.com"), backslash tricks,
 * full URLs or other areas of the domain (such as "/phase1"), so the sign-in page cannot be used as an
 * open redirect. Anything else falls back to the account page.
 */
export function safeNextPath(next: string | null | undefined, fallback = `${PM}/account`): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next)) return fallback;
  if (!(next === PM || next.startsWith(`${PM}/`) || next.startsWith(`${PM}?`) || next.startsWith(`${PM}#`))) {
    return fallback;
  }
  return next;
}
