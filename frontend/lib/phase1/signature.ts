/** Dayyan's email signature, only for mail sent as his arepolabs address. Pure; the sender, Send test and the preview share it. */
import { bodyToHtml, escapeHtml } from "./html-email";

export const SIGNATURE_SENDER = "dayyan.sheikh@arepolabs.com";
export const SIG_NAME = "Dayyan Sheikh";
export const SIG_COMPANY = "Arepo Labs";
export const SIG_SITE_TEXT = "arepolabs.com";
export const SIG_SITE_URL = "https://arepolabs.com";
export const SIG_EMAIL = "dayyan.sheikh@arepolabs.com";
export const SIG_ADDRESS = "White City, Shepherd's Bush, London";
export const SIG_LOGO_URL = "https://www.arepolabs.com/brand/arepo-icon-light.png";

export const hasSignature = (fromAddress: string | null | undefined): boolean =>
  (fromAddress ?? "").trim().toLowerCase() === SIGNATURE_SENDER;

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const link = (href: string, text: string) => `<a href="${escapeHtml(href)}" style="color:#101010;text-decoration:none;">${escapeHtml(text)}</a>`;

/** The signature block alone (what goes into Gmail settings). */
export function signatureHtml(): string {
  return [
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:16px;border-collapse:collapse;">`,
    `<tr>`,
    `<td valign="middle" style="padding:0 14px 0 0;"><img src="${SIG_LOGO_URL}" width="48" height="48" alt="Arepo Labs" style="display:block;border:0;width:48px;height:48px;"></td>`,
    `<td valign="middle" style="border-left:2px solid #E50C0E;padding:0 0 0 14px;${FONT}">`,
    `<div style="${FONT}font-size:14px;line-height:19px;font-weight:bold;color:#101010;">${escapeHtml(SIG_NAME)}</div>`,
    `<div style="${FONT}font-size:13px;line-height:18px;color:#555555;">${escapeHtml(SIG_COMPANY)}</div>`,
    `<div style="${FONT}font-size:13px;line-height:18px;color:#555555;">${link(SIG_SITE_URL, SIG_SITE_TEXT)} | ${link(`mailto:${SIG_EMAIL}`, SIG_EMAIL)}</div>`,
    `<div style="${FONT}font-size:13px;line-height:18px;color:#555555;">${escapeHtml(SIG_ADDRESS)}</div>`,
    `</td>`,
    `</tr>`,
    `</table>`,
  ].join("\n");
}

export const signatureText = (): string => [SIG_NAME, SIG_COMPANY, `${SIG_SITE_TEXT} | ${SIG_EMAIL}`, SIG_ADDRESS].join("\n");

/** Drop the typed name lines after "Kind regards," so the signature supplies them. */
export function stripTrailingName(body: string): string {
  return body.replace(/(Kind regards,?)[ \t]*\r?\n+[ \t]*Dayyan Sheikh[ \t]*(?:\r?\n+[ \t]*Arepo Labs[ \t]*)?\s*$/i, "$1");
}

/** The plain-text part. Unchanged for any other sender. */
export function emailText(body: string, fromAddress: string | null | undefined): string {
  if (!hasSignature(fromAddress)) return body;
  const b = stripTrailingName(body).replace(/\s+$/, "");
  return `${b}${/Kind regards,?$/i.test(b) ? "\n" : "\n\n"}${signatureText()}`;
}

/** The HTML part. Unchanged for any other sender. */
export function emailHtml(body: string, fromAddress: string | null | undefined): string {
  if (!hasSignature(fromAddress)) return bodyToHtml(body);
  return `${bodyToHtml(stripTrailingName(body))}\n${signatureHtml()}`;
}
