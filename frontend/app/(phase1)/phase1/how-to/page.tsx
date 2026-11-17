import Link from "next/link";
import { GAP_MAX_SECONDS, GAP_MIN_SECONDS, DAILY_CAP } from "@/lib/phase1/send";

export const metadata = { title: "How to use Phase 1" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-arepo-border bg-white p-5">
      <h2 className="font-display text-lg text-arepo-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-sm text-arepo-ink2">{children}</div>
    </section>
  );
}

const Steps = ({ items }: { items: React.ReactNode[] }) => (
  <ol className="list-decimal space-y-1 pl-5">{items.map((x, i) => <li key={i}>{x}</li>)}</ol>
);

export default function Page() {
  const mins = (s: number) => Math.round(s / 60);
  return (
    <div className="max-w-reading space-y-5">
      <div>
        <h1 className="font-display text-2xl text-arepo-ink">How to use Phase 1</h1>
        <p className="mt-2 text-sm text-arepo-muted">
          This page sends short, plain emails to a list of businesses and keeps track of who replied. It also tests two versions of each email (A and B) so you learn which one works better.
        </p>
        <p className="mt-1 text-sm text-arepo-muted">Looking for the reasons behind each wave? See the <Link className="underline" href="/phase1/plan">Plan</Link> page.</p>
      </div>

      <Section title="The two tabs">
        <p><span className="font-medium">Dayyan</span> is startups. <span className="font-medium">Jack</span> is local trades. Each tab shows only its own businesses and its own emails.</p>
        <p>You can look at the other tab, but you can only send from your own. Every email goes out from your own Gmail and is signed with your name.</p>
      </Section>

      <Section title="Before your first send">
        <Steps items={[
          "Sign in to this page.",
          <>Press <span className="font-medium">Connect Gmail</span> on the Phases page and sign in with your own Gmail account. The page says &quot;Gmail connected&quot; when it worked.</>,
          <>In Gmail, set your arepolabs address up under Settings, Accounts and Import, &quot;Send mail as&quot;, and verify it. Emails go out as that address. If it is missing or not verified, the page says so and Send stays off until it is.</>,
          "First emails go out on Wed 18 Nov. Do the steps above before then.",
        ]} />
        <p>Google is still in testing mode for this app, so the Gmail connection lasts 7 days. When it runs out the page asks you to reconnect. Press Reconnect and carry on.</p>
      </Section>

      <Section title="Each phase card">
        <p>A phase tests one thing. Version A and version B are the same email apart from that one thing, so the replies tell you which is better. The card shows both versions.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium">Preview email</span> shows the exact email a recipient will read, one per version, with a drop-down to pick the business.</li>
          <li><span className="font-medium">Recipients</span> lists everyone in the phase with their status. Untick anyone you do not want to send to.</li>
          <li><span className="font-medium">Send</span> is always on your own tab. If it is greyed out, the reason is written next to it. Press it, check the count, then press &quot;Yes, send&quot;.</li>
        </ul>
        <p>Emails go one at a time with a pause of {mins(GAP_MIN_SECONDS)} to {mins(GAP_MAX_SECONDS)} minutes between them. Keep the page open while it runs. You can press &quot;Stop after this one&quot;. Each mailbox can send at most {DAILY_CAP} emails a day.</p>
        <p>Every email carries a line saying how to opt out, above the sign-off.</p>
      </Section>

      <Section title="Follow-ups">
        <p>Each email can have follow-ups saved with a send date. When that date arrives, a Send follow-ups button appears on the card. A follow-up only goes to someone who got the first email from you and has not replied, opted out or bounced.</p>
      </Section>

      <Section title="Replies and opt-outs">
        <p>The Replies page checks your Gmail for answers and matches each one to the business it came from. It sorts out bounces and automatic out-of-office replies, and it spots plain opt-outs such as &quot;stop&quot; or &quot;please remove me&quot;.</p>
        <p>For real replies it suggests a type (for example interested, or not now) and a prepared answer. You can edit it before it is sent.</p>
        <p>Anyone who opts out, or whose address bounces, is never emailed again.</p>
      </Section>

      <Section title="How A and B are judged">
        <p>Each phase has a judge date. Before then the card shows which version is ahead. On the day, an <span className="font-medium">Accept result</span> button appears.</p>
        <p>The rule on the phase says what counts. Booked calls are what matter most, then positive replies, then any reply. Each version needs a minimum number of emails sent first. If it does not get there, or the two are level, the result is &quot;no clear winner&quot; and nothing is changed because of it. Accepting the result starts the next phase.</p>
      </Section>

      <Section title="Getting more leads">
        <p>On the Phases page, under &quot;More prospects&quot;, press <span className="font-medium">Generate new batch</span>. Pick a track, how many and where, then press Request leads. That saves a request. Ask TENET for the next wave and it fills the request.</p>
        <p>New leads come back to the same page as &quot;New leads to review&quot;. Press Approve or Skip on each one. Only approved leads join a phase. The Prospects page lists everyone.</p>
      </Section>

      <Section title="Good habits">
        <ul className="list-disc space-y-1 pl-5">
          <li>Send in the morning.</li>
          <li>No attachments.</li>
          <li>Keep it to about 10 a day from a personal Gmail, even though the page allows {DAILY_CAP}.</li>
          <li>Check the preview before the first send of every phase.</li>
        </ul>
      </Section>
    </div>
  );
}
