/**
 * Who may be emailed. PECR treats a limited company or LLP as a corporate subscriber (may be emailed);
 * a sole trader or ordinary partnership is an individual and needs consent. `unknown` is allowed with a
 * warning to check Companies House. (The database column legal_ok is stricter: it is false for unknown,
 * so the dashboard uses these rules instead of that column to decide a block.)
 */
import type { CompanyType, ProspectStatus } from "./types";

export interface RuleProspect {
  public_email: string | null;
  status: ProspectStatus;
  company_type: CompanyType;
  consent_recorded: boolean;
}

export interface SendCheck {
  blocked: boolean;
  /** Why the row cannot be sent (shown on the row; the batch skips it). */
  reasons: string[];
  /** Shown but does not block. */
  warnings: string[];
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isValidEmail(s: string | null | undefined): boolean {
  return !!s && EMAIL.test(s.trim());
}

/** True for a limited company, an LLP, or anyone with recorded consent. */
export function isCorporateOrConsented(p: Pick<RuleProspect, "company_type" | "consent_recorded">): boolean {
  return p.company_type === "ltd" || p.company_type === "llp" || p.consent_recorded;
}

export function checkSendable(p: RuleProspect): SendCheck {
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (!p.public_email || !p.public_email.trim()) reasons.push("No email address");
  else if (!isValidEmail(p.public_email)) reasons.push("Email address looks wrong");
  if (p.status === "do_not_contact") reasons.push("Do not contact");
  if ((p.company_type === "sole_trader" || p.company_type === "partnership") && !p.consent_recorded) {
    reasons.push("Sole trader or partnership: needs consent first");
  }
  if (p.company_type === "unknown" && !p.consent_recorded) warnings.push("Check Companies House");
  if (p.status !== "prospect" && p.status !== "do_not_contact") warnings.push(`Already ${p.status.replace("_", " ")}`);
  return { blocked: reasons.length > 0, reasons, warnings };
}
