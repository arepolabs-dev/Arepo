/**
 * Row types for every Phase 1 table. They mirror supabase/phase1/0001_init.sql column for column.
 * Timestamps are ISO strings, dates are "YYYY-MM-DD", uuids are strings.
 */

export type Uuid = string;
export type Iso = string;

export type Tier = "A" | "B" | "C";
export type Area = "W12/W6" | "W3-W7" | "W10/W11/NW10" | "NW10/NW6";
export type SourceDoc = "09" | "10" | "11" | "13" | "17" | "notes";
export type Channel = "email" | "walk_in" | "warm" | "online";
export type CompanyType = "ltd" | "llp" | "sole_trader" | "partnership" | "unknown";

/** Pipeline order is fixed in code (lib/phase1/pipeline.ts, WP4); `do_not_contact` is terminal. */
export type ProspectStatus =
  | "prospect"
  | "contacted"
  | "replied"
  | "call_booked"
  | "discovery"
  | "proposal"
  | "won"
  | "lost"
  | "do_not_contact";

export type VariantKind = "subject" | "body" | "opener" | "ask" | "follow_up" | "signature";
export type Tone = "homely" | "professional" | "neutral";
export type Audience = "trades" | "shops" | "cafes" | "ai_keen" | "all";
export type VariantStatus = "active" | "retired";
export type VariantSource = "jack" | "dayyan_edit" | "v2" | "v1" | "tests";
export type TestVariable =
  | "subject"
  | "opener"
  | "ask"
  | "tone"
  | "length"
  | "send_time"
  | "follow_up";
export type OutreachStatus = "composed" | "sent" | "bounced" | "replied" | "stopped";
export type ReplyType =
  | "unclassified"
  | "positive"
  | "neutral"
  | "no"
  | "stop"
  | "bounce"
  | "auto";
export type EventKind =
  | "status_change"
  | "call_booked"
  | "discovery_done"
  | "proposal_sent"
  | "won"
  | "lost"
  | "walk_in"
  | "note"
  | "follow_up_sent";
export type ChecklistSection = "week1" | "week2" | "legal" | "setup" | "backlog";

export interface Person {
  id: Uuid;
  email: string;
  name: string | null;
  initials: string | null;
  colour: string | null;
  created_at: Iso;
}

export interface Prospect {
  id: Uuid;
  name: string;
  vertical: string | null;
  trade_or_type: string | null;
  tier: Tier | null;
  area: Area | null;
  postcode: string | null;
  website: string | null;
  maps_url: string | null;
  public_email: string | null;
  phone_public: string | null;
  source_doc: SourceDoc | null;
  owner_id: Uuid | null;
  channel: Channel | null;
  company_type: CompanyType;
  companies_house_no: string | null;
  /** Generated column: company_type in (ltd, llp) or consent_recorded. Never written. */
  legal_ok: boolean;
  consent_recorded: boolean;
  consent_note: string | null;
  email_found: boolean;
  status: ProspectStatus;
  status_changed_at: Iso;
  first_name: string | null;
  opener_general: string | null;
  opener_specific: string | null;
  subject_hint: string | null;
  why_fit: string | null;
  suggested_angle: string | null;
  batch_id: Uuid | null;
  notes: string | null;
  created_at: Iso;
  updated_at: Iso;
}

export interface Batch {
  id: Uuid;
  label: string;
  stage: 1 | 2 | 3 | 4;
  planned_date: string | null;
  subject_variant_id: Uuid | null;
  body_variant_id: Uuid | null;
  owner_id: Uuid | null;
  size_planned: number | null;
  notes: string | null;
}

export interface Variant {
  id: Uuid;
  kind: VariantKind;
  code: string;
  label: string | null;
  text: string;
  tone: Tone | null;
  audience: Audience | null;
  status: VariantStatus;
  source: VariantSource | null;
  created_at: Iso;
}

export interface Test {
  id: Uuid;
  name: string;
  variable: TestVariable;
  variant_a_id: Uuid | null;
  variant_b_id: Uuid | null;
  started_at: Iso | null;
  batch_size: number | null;
  decision_rule: string | null;
  result: string | null;
  decided_at: Iso | null;
}

export interface OutreachEmail {
  id: Uuid;
  prospect_id: Uuid;
  owner_id: Uuid | null;
  batch_id: Uuid | null;
  test_id: Uuid | null;
  subject_variant_id: Uuid | null;
  body_variant_id: Uuid | null;
  opener_used: string | null;
  to_address: string | null;
  subject: string | null;
  body_rendered: string | null;
  composed_at: Iso;
  /** Null until the message is seen in the Sent folder. */
  sent_at: Iso | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  rfc_message_id: string | null;
  follow_up_of: Uuid | null;
  status: OutreachStatus;
}

export interface Reply {
  id: Uuid;
  outreach_email_id: Uuid | null;
  prospect_id: Uuid | null;
  owner_id: Uuid | null;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  from_address: string;
  received_at: Iso;
  snippet: string | null;
  body_text: string | null;
  reply_type: ReplyType;
  classified_by: Uuid | null;
  classified_at: Iso | null;
}

export interface EventRow {
  id: Uuid;
  prospect_id: Uuid | null;
  owner_id: Uuid | null;
  kind: EventKind;
  at: Iso;
  detail: Record<string, unknown> | null;
}

export interface Mailbox {
  id: Uuid;
  owner_id: Uuid;
  address: string;
  provider: "gmail";
  /** Encrypted with PHASE1_TOKEN_KEY; never sent to the browser. */
  refresh_token_enc: string | null;
  history_id: string | null;
  last_sync_at: Iso | null;
  last_error: string | null;
}

export interface ChecklistItem {
  id: Uuid;
  section: ChecklistSection;
  text: string;
  owner_id: Uuid | null;
  due: string | null;
  done_at: Iso | null;
  /** The plan calls this column "order"; it is `sort_order` in SQL because ORDER is reserved. */
  sort_order: number;
}

/** Table name -> row type. */
export interface Phase1Tables {
  people: Person;
  prospects: Prospect;
  batches: Batch;
  variants: Variant;
  tests: Test;
  outreach_emails: OutreachEmail;
  replies: Reply;
  events: EventRow;
  mailboxes: Mailbox;
  checklist: ChecklistItem;
}

export type TableName = keyof Phase1Tables;
export type Row<T extends TableName> = Phase1Tables[T];
/** Writes are partial: the database fills id, created_at and defaults and enforces NOT NULL. */
export type Insert<T extends TableName> = Partial<Row<T>>;

export const TABLE_NAMES: TableName[] = [
  "people",
  "prospects",
  "batches",
  "variants",
  "tests",
  "outreach_emails",
  "replies",
  "events",
  "mailboxes",
  "checklist",
];

export const PIPELINE_STAGES: ProspectStatus[] = [
  "prospect",
  "contacted",
  "replied",
  "call_booked",
  "discovery",
  "proposal",
  "won",
  "lost",
];

/** The signed-in, allowlisted user. */
export interface Phase1User {
  email: string;
  initials: string;
  /** The matching `people` row id when known (null if the people row is not seeded yet). */
  personId: Uuid | null;
}
