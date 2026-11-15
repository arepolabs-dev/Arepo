/**
 * All words on the agency landing page live here. British English, digits for numbers, no em dashes.
 * Dayyan, 15 Nov: short, no prices, no "Recent work", no footer, no link to the prediction-market
 * site, exactly 1 booking button, a "Who we are" section with public-facing facts only.
 */

export const CALENDLY = "https://calendly.com/dayyan-sheikh-arepolabs/30min";
export const EMAIL = "dayyan.sheikh@arepolabs.com";

export const copy = {
  meta: {
    title: "Arepo Labs",
    description:
      "Practical automation for local businesses. 2 engineers in west London who take the repetitive admin off your plate.",
  },
  nav: {
    brand: "Arepo Labs",
    links: [
      { label: "What we do", href: "#what" },
      { label: "Who we are", href: "#who" },
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
  what: {
    label: "What we do",
    title: "The jobs you would happily never do again.",
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
  who: {
    label: "Who we are",
    title: "2 engineers who like fixing things properly.",
    people: [
      {
        name: "Dayyan Sheikh",
        role: "Co-founder, engineer",
        // Source: his LinkedIn export (UCL, Biomedical Engineering, Sep 2022 to Jun 2026) and ~/Vault/Me (MEng).
        bio: "Works in software. MEng Biomedical Engineering, UCL.",
        initials: "DS",
        photo: "/team/dayyan.jpg",
      },
      {
        name: "Jack Burbridge",
        role: "Co-founder, engineer",
        // Source: Dayyan's LinkedIn connections export (Technical Account Manager, Fospha, Oct 2026) and
        // Dayyan's own brief (both studied engineering). TODO(confirm): Jack's degree subject and university.
        bio: "Works in tech, as a Technical Account Manager at Fospha. Studied engineering.",
        initials: "JB",
        photo: "/team/jack.jpg",
      },
    ],
  },
  contact: {
    label: "Contact",
    title: "Tell us the 1 job you would happily never do again.",
    body: "Email us, or book a chat at the top of the page.",
  },
} as const;
