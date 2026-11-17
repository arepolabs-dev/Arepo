/**
 * The HTML twin of a plain-text outreach body: escaped, paragraphs kept, Calendly links shown as a short phrase.
 * Pure and dependency-free so the sender and the preview use exactly the same thing. No styles, images or tracking.
 */

const URL_SRC = String.raw`https?:\/\/calendly\.com\/[^\s<>"')]*[^\s<>"')\].,;:!?]`;
const LINK_RE = new RegExp(String.raw`(pick a time here)[ \t]*:[ \t]*(${URL_SRC})|(${URL_SRC})`, "gi");

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const anchor = (url: string, text: string) => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`;

/** Inline HTML for one block of text (no paragraph wrapper): links turned into phrases, newlines into <br>. */
function inline(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    out += escapeHtml(text.slice(last, start));
    if (m[1]) {
      out += anchor(m[2]!, m[1]);
      if (text[end] !== ".") out += ".";
    } else {
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const nl = text.indexOf("\n", end);
      const lineEnd = nl === -1 ? text.length : nl;
      const alone = text.slice(lineStart, start).trim() === "" && text.slice(end, lineEnd).trim() === "";
      out += anchor(m[3]!, alone ? "Book a time" : "this link");
    }
    last = end;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\r?\n/g, "<br>\n");
}

export function bodyToHtml(body: string): string {
  const paras = body.replace(/\r\n/g, "\n").replace(/\s+$/, "").split(/\n{2,}/);
  return `<div>${paras.map((p) => `<p>${inline(p)}</p>`).join("\n")}</div>`;
}
