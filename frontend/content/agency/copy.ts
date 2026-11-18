/**
 * All words on the agency landing page live here. British English, digits for numbers (except the
 * "Who we are" header, which Dayyan wrote), no em dashes.
 * Dayyan, 15 Nov: short, no prices, no "Recent work", no footer, no link to the prediction-market
 * site, exactly 1 booking button, a "Who we are" section with public-facing facts only.
 */

/** The 1 primary booking button (hero) points here. */
export const CALENDLY = "https://calendly.com/dayyan-sheikh-arepolabs/30min";
// TODO: Jack's Calendly link. While empty, Contact shows only his email (Dayyan, 15 Nov).
export const JACK_CALENDLY = "https://calendly.com/jackburbridge72/30min";
/** General enquiries: the 1 address in the hero "or email" line and the main Contact email. */
export const EMAIL_GENERAL = "enquiries@arepolabs.com";
export const EMAIL = "dayyan.sheikh@arepolabs.com";
export const EMAIL_JACK = "jack.burbridge@arepolabs.com";

/** Each founder's own email and calendar link, shown under their profile in Who we are. */
export const contacts = [
  { name: "Dayyan Sheikh", email: EMAIL, calendly: CALENDLY },
  { name: "Jack Burbridge", email: EMAIL_JACK, calendly: JACK_CALENDLY },
] as const;

export const copy = {
  meta: {
    title: "Arepo Labs",
    description:
      "Practical automation for local businesses. 2 engineers based in West London, working across the UK, who take the repetitive admin off your plate.",
  },
  // No black strip above the nav (Dayyan, 16 Nov 00:06): the red top bar is the only bar.
  nav: {
    brand: "Arepo Labs",
    links: [
      { label: "Who we are", href: "#who" },
      { label: "What we do", href: "#what" },
      { label: "Contact", href: "#contact" },
    ],
  },
  hero: {
    eyebrow: "Arepo Labs, based in West London, working across the UK",
    h1: "Practical automation for local businesses.",
    sub: "We are 2 engineers. We build small tools that take the repetitive admin off your plate, so your time goes on the work that pays.",
    cta: "Book a free chat",
    emailLead: "or email",
  },
  /** The strip that slides as you scroll: the jobs we take off people's plates. */
  ticker: ["Invoices", "Quotes", "Missed calls", "Bookings", "Receipts", "Reviews", "Enquiries", "Reminders"],
  who: {
    label: "Who we are",
    // Dayyan's own wording (voice note, 15 Nov): "Two" as a word here.
    title: "Two engineers who like fixing things properly.",
    // Both are AI automation engineers and technical account managers (Dayyan, 15 Nov, round 3).
    // Public-facing and general: no employer is named.
    people: [
      {
        name: "Dayyan Sheikh",
        role: "Co-founder, AI automation engineer and technical account manager",
        bio: "Master of Engineering, UCL",
        // Dayyan, 16 Nov 00:06: more personal, not the same as Jack's: UCL contract work, consulting, local businesses.
        proof: "Did contract work for UCL, building automations and advising teams on how to use them, alongside consulting on the side. Now he builds the same kind of tools for local businesses, and likes nothing more than turning a 2-hour chore into a 2-minute one.",
        initials: "DS",
        photo: "/team/dayyan.jpg",
        email: EMAIL,
        calendly: CALENDLY,
      },
      {
        name: "Jack Burbridge",
        role: "Co-founder, AI automation engineer and technical account manager",
        bio: "Bachelor of Engineering, Exeter",
        proof: "An engineer by training who spends his days with clients, working out what is really slowing them down. Keen on AI and on building things that last, he makes sure every tool fits the way your business already works.",
        initials: "JB",
        photo: "/team/jack.jpg",
        email: EMAIL_JACK,
        calendly: JACK_CALENDLY,
      },
    ],
  },
  what: {
    label: "What we do",
    title: "3 jobs we take off your hands.",
    items: [
      {
        title: "Quotes and invoices, chased",
        body: "Money sits unpaid because chasing it feels awkward. We send the polite reminders for you, on time, every time. You get paid sooner.",
      },
      {
        title: "Enquiries, answered",
        body: "A missed call on site is a lost job. We text back within minutes and reply to every enquiry sensibly. You win the work you used to miss.",
      },
      {
        title: "Books, kept tidy",
        body: "Receipts in a shoebox, bookings in your head. We file receipts into your accounts and send booking reminders. You get a daily list of what is open.",
      },
    ],
  },
  custom: {
    label: "Something else?",
    title: "Something else eating your week?",
    body: "We also build custom, boutique automation workflows around how you already work. If you do it the same way every time, we can probably automate it.",
    examples: ["Stock and orders", "Customer follow-ups", "Reports", "Rotas", "Paperwork"],
  },
  how: {
    label: "How it works",
    steps: [
      { title: "A free look", body: "We see how you work, in person where practical or on a video call. If nothing is worth fixing, we say so." },
      { title: "A 1-page note", body: "1 to 3 fixes, each with a fixed price agreed up front." },
      { title: "Built and handed over", body: "It runs on your own computer. You own it. We stay on hand for 30 days." },
    ],
  },
  contact: {
    label: "Contact",
    title: "Tell us the 1 job you would happily never do again.",
    body: "Book a free chat, or email us. No pitch, just a look at how you work.",
    bookLabel: "Book a free chat",
    detailsLabel: "Contact details",
    areaLine: "Based in West London, working across the UK. We come to you wherever practical, or meet on video.",
    calendarLabel: "Book a chat",
  },
} as const;
