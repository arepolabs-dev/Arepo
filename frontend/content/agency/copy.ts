/**
 * All words on the agency landing page live here. British English, digits for numbers (except the
 * "Who we are" header, which Dayyan wrote), no em dashes.
 * Dayyan, 15 Nov: short, no prices, no "Recent work", no footer, no link to the prediction-market
 * site, exactly 1 booking button, a "Who we are" section with public-facing facts only.
 */

/** The 1 primary booking button (hero) points here. */
export const CALENDLY = "https://calendly.com/dayyan-sheikh-arepolabs/30min";
// TODO: Jack's Calendly link. While empty, Contact shows only his email (Dayyan, 15 Nov).
export const JACK_CALENDLY = "";
/** General enquiries: the 1 address in the hero "or email" line and the main Contact email. */
export const EMAIL_GENERAL = "enquiries@arepolabs.com";
export const EMAIL = "dayyan.sheikh@arepolabs.com";
export const EMAIL_JACK = "jack.burbridge@arepolabs.com";

/** Each founder's own email and calendar link, listed under Contact as plain text links. */
export const contacts = [
  { name: "Dayyan Sheikh", email: EMAIL, calendly: CALENDLY },
  { name: "Jack Burbridge", email: EMAIL_JACK, calendly: JACK_CALENDLY },
] as const;

export const copy = {
  meta: {
    title: "Arepo Labs",
    description:
      "Practical automation for local businesses. 2 engineers in west London who take the repetitive admin off your plate.",
  },
  /** The slim strip above the nav. Plain text and an in-page link: not a 2nd booking button. */
  banner: {
    text: "Now booking free automation chats in west London.",
    linkLabel: "Get in touch",
    href: "#contact",
  },
  nav: {
    brand: "Arepo Labs",
    links: [
      { label: "Who we are", href: "#who" },
      { label: "What we do", href: "#what" },
      { label: "Contact", href: "#contact" },
    ],
  },
  hero: {
    eyebrow: "Arepo Labs, west London",
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
    people: [
      {
        name: "Dayyan Sheikh",
        role: "Co-founder, engineer",
        bio: "Master of Engineering, UCL",
        initials: "DS",
        photo: "/team/dayyan.jpg",
      },
      {
        name: "Jack Burbridge",
        role: "Co-founder, engineer",
        bio: "Bachelor of Engineering, Exeter",
        initials: "JB",
        photo: "/team/jack.jpg",
      },
    ],
  },
  what: {
    label: "What we do",
    title: "3 jobs we take off your hands.",
    items: [
      {
        title: "Quotes and invoices chased",
        body: "Reminders go out when a quote or invoice has sat too long. Nothing slips.",
      },
      {
        title: "Enquiries answered",
        body: "A sensible reply within minutes, and a text back when you miss a call on site.",
      },
      {
        title: "Books kept tidy",
        body: "Receipts into your accounts, booking reminders, a daily list of what is open.",
      },
    ],
  },
  how: {
    label: "How it works",
    steps: [
      { title: "A free look", body: "We come to you and see how you work. If nothing is worth fixing, we say so." },
      { title: "A 1-page note", body: "1 to 3 fixes, each with a fixed price agreed up front." },
      { title: "Built and handed over", body: "It runs on your own computer. You own it. We stay on hand for 30 days." },
    ],
  },
  contact: {
    label: "Contact",
    title: "Tell us the 1 job you would happily never do again.",
    body: "Or reach either of us directly.",
    calendarLabel: "Book a chat",
  },
} as const;
