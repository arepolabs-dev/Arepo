import type { EventKind, ProspectStatus } from "./types";

export const STAGE_LABELS: Record<ProspectStatus, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  replied: "Replied",
  call_booked: "Call booked",
  discovery: "Discovery",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
  do_not_contact: "Do not contact",
};

/** The event written when a prospect moves into a status. */
export function eventForStatus(to: ProspectStatus): EventKind {
  switch (to) {
    case "call_booked":
      return "call_booked";
    case "discovery":
      return "discovery_done";
    case "proposal":
      return "proposal_sent";
    case "won":
      return "won";
    case "lost":
      return "lost";
    default:
      return "status_change";
  }
}
