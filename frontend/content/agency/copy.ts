/** All words on the agency landing page live here. British English, digits for numbers, no em dashes. */

export const CALENDLY = "https://calendly.com/dayyan-sheikh-arepolabs/30min";
export const EMAIL = "dayyan.sheikh@arepolabs.com";

export const copy = {
  meta: {
    title: "Arepo Labs",
    description:
      "Small software fixes for busy local businesses. We build simple tools that take repetitive admin off your plate, so you save hours and stop money slipping through the cracks.",
  },
  header: {
    brand: "Arepo Labs",
    cta: "Book a free 15-minute chat",
    research: "Our research project",
  },
  hero: {
    h1: "Small software fixes for busy local businesses.",
    sub: "We are 2 software engineers based in Shepherd's Bush. We build small tools that take the repetitive admin off your plate, so you get hours back every week and stop money slipping away: invoices that go out on time, quotes that get chased, enquiries that get a quick reply. Built once, runs on your own computer, and you own it.",
    cta: "Book a free 15-minute chat",
    emailLead: "Or email",
  },
  fix: {
    title: "What we fix",
    cards: [
      {
        title: "Invoices and quotes",
        body: "Reminders go out when a quote or invoice has sat too long. Nothing slips, and you get paid sooner.",
      },
      {
        title: "Enquiries and missed calls",
        body: "A sensible reply within minutes, and a text back when you cannot pick up on site.",
      },
      {
        title: "The rest",
        body: "Booking reminders, review requests, receipts into your books, a daily list of what is open.",
      },
    ],
  },
  saves: {
    title: "Time and money back",
    body: "Admin eats evenings. Every job you stop doing by hand is an hour back and an invoice paid sooner, week after week.",
  },
  how: {
    title: "How it works",
    steps: [
      "A free 45-minute look at how you work, at your place or over a coffee. If nothing is worth fixing, we say so.",
      "A one-page note within 48 hours: 1 to 3 fixes, each with a fixed price.",
      "We build it, hand it over and show you how it runs. 30 days of fixes included.",
    ],
  },
  different: {
    title: "Why it is different",
    bullets: [
      // Dayyan 15 Nov: no prices on the landing page; request a quote.
      "Fixed price, agreed up front. Ask us for a free quote.",
      "Runs on your own computer. No monthly subscription unless you want ongoing support.",
      "You keep the code and the data. We never hold your main passwords; you give us a key you can revoke.",
      "Plain workflows first. AI only where it earns its place, and always with your approval step.",
    ],
  },
  work: {
    title: "Recent work",
    card: {
      title: "TeamUCL Gym",
      body: "An automatic email reply system, so general enquiries get a sensible answer straight away and the team only handles the ones that need a person.",
    },
  },
  who: {
    title: "Who we are",
    people: [
      {
        name: "Dayyan Sheikh",
        bio: "Software engineer (MEng, UCL), based in Shepherd's Bush.",
      },
      {
        name: "Jack Burbridge",
        // CONFIRM: (c) Jack's one-line bio is a draft. Jack to confirm.
        bio: "Solutions engineer, working in tech.",
      },
    ],
    area: "We work in W12, W6, W10, W11 and NW10 and the streets around them.",
  },
  final: {
    title: "Tell us the one job you would happily never do again.",
    cta: "Book a free 15-minute chat",
    warm: "Looking forward to hearing from you.",
  },
  footer: {
    line: "Arepo Labs, Shepherd's Bush, London.",
    // Dayyan 15 Nov: footer removed from the landing page for now (unused).
    legal: "Arepo Labs is a trading name of Dayyan Sheikh.",
    research: "Arepo prediction-market research",
  },
} as const;
