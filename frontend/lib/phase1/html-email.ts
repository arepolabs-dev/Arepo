/**
 * The HTML twin of a plain-text outreach body: escaped, paragraphs kept, Calendly links shown as a short phrase,
 * **bold** markers shown bold. Pure and dependency-free so the sender and the preview use exactly the same thing.
 * No images or tracking. `styled` (Dayyan's sender only) adds inline type, spacing and the brand link colour.
 */

const URL_SRC = String.raw`https?:\/\/calendly\.com\/[^\s<>"')]*[^\s<>"')\].,;:!?]`;
const LINK_RE = new RegExp(String.raw`(pick a time here)[ \t]*:[ \t]*(${URL_SRC})|(${URL_SRC})`, "gi");

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const BOLD_RE = /\*\*(\S(?:[^*\n]*?\S)?)\*\*/g;

/** The plain-text part never shows the asterisks: "**free**" becomes "free". */
export const stripBold = (s: string): string => s.replace(BOLD_RE, "$1");

const BRAND_RED = "#E50C0E";
const BODY_STYLE = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#1a1a1a;max-width:600px;";
const P_STYLE = "margin:0 0 14px;";
const OPT_OUT_STYLE = "margin:0 0 14px;color:#6b6b6b;font-size:13px;";
const LINK_STYLE = `color:${BRAND_RED};font-weight:bold;text-decoration:none;`;

const anchor = (url: string, text: string, styled = false) =>
  styled
    ? `<a href="${escapeHtml(url)}" style="${LINK_STYLE}">${escapeHtml(text)} &rarr;</a>`
    : `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;

/** Escape, then turn **x** into <b>x</b> (asterisks are untouched by escaping). */
const escBold = (s: string) => escapeHtml(s).replace(BOLD_RE, "<b>$1</b>");

/** Inline HTML for one block of text (no paragraph wrapper): links turned into phrases, newlines into <br>. */
function inline(text: string, styled = false): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    out += escBold(text.slice(last, start));
    if (m[1]) {
      out += anchor(m[2]!, m[1], styled);
      if (!styled && text[end] !== ".") out += ".";
    } else {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const nl = text.indexOf("\n", end);
      const lineEnd = nl === -1 ? text.length : nl;
      const alone = text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === "";
      out += anchor(m[3]!, alone ? "Book a time" : "this link", styled && alone);
    }
    last = end;
  }
  let rest = text.slice(last);
  if (styled && last > 0 && /^\.(?=\s*$)/.test(rest)) rest = rest.slice(1); // "Pick a time here →" needs no full stop
  out += escBold(rest);
  return out.replace(/\r?\n/g, "<br>\n");
}

const isOptOut = (p: string) => /^if you'd rather not hear from me/i.test(p.trim());

export function bodyToHtml(body: string, opts: { styled?: boolean } = {}): string {
  const paras = body.replace(/\r\n/g, "\n").replace(/\s+$/, "").split(/\n{2,}/);
  if (!opts.styled) return `<div>${paras.map((p) => (isOptOut(p) ? `<p style="${OPT_OUT_STYLE}">${inline(p)}</p>` : `<p>${inline(p)}</p>`)).join("\n")}</div>`;
  const ps = paras.map((p, i) => {
    const style = isOptOut(p) ? OPT_OUT_STYLE : i === paras.length - 1 ? "margin:0;" : P_STYLE;
    return `<p style="${style}">${inline(p, true)}</p>`;
  });
  return `<div style="${BODY_STYLE}">${ps.join("\n")}</div>`;
}
