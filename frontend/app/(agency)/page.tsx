import { Banner, Header } from "@/components/agency/Header";
import { HeroArt, Portrait, Reveal, ScrollTicker } from "@/components/agency/motion";
import { CALENDLY, EMAIL_GENERAL, contacts, copy } from "@/content/agency/copy";

/*
 * Agency landing page. Editorial, left-aligned, a 12-column grid on desktop that stacks on a phone.
 * Native scrolling. 1 primary booking button (hero, Arepo red); Contact lists each founder's email
 * and calendar as plain text links. No prices, no "Recent work", no footer, no link to /predictionmarket.
 * Order (Dayyan, 15 Nov): hero, ticker, Who we are, What we do, How it works, Contact.
 */

const shell = "mx-auto w-full max-w-shell px-5 sm:px-10";
const label = "font-display text-xs font-medium uppercase tracking-[0.22em] text-arepo-accent";
const h2 = "font-display text-3xl font-semibold leading-[1.1] tracking-tight text-arepo-ink sm:text-5xl";

export default function AgencyPage() {
  return (
    <>
      <div id="top" />
      <Banner />
      <Header />
      <main className="flex-1">
        {/* Hero: 7 columns of words, 5 of the mark. */}
        <section data-testid="hero" className={`${shell} grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:py-28`}>
          <div className="lg:col-span-7">
            <Reveal as="p" className={label}>
              {copy.hero.eyebrow}
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-5 max-w-[14ch] font-display text-5xl font-semibold leading-[1.02] tracking-tight text-arepo-ink sm:text-6xl lg:text-7xl">
                {copy.hero.h1}
              </h1>
            </Reveal>
            <Reveal as="p" delay={0.16} className="mt-7 max-w-[46ch] text-lg leading-relaxed text-arepo-ink2 sm:text-xl">
              {copy.hero.sub}
            </Reveal>
            <Reveal delay={0.24} className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
              <a
                href={CALENDLY}
                data-testid="primary-cta"
                className="focus-ring inline-block rounded-control bg-arepo-accent px-6 py-3.5 text-base font-medium text-arepo-accentFg shadow-arepo-card transition-colors hover:bg-arepo-accentHover active:bg-arepo-accentActive"
              >
                {copy.hero.cta}
              </a>
              <span className="text-sm text-arepo-muted">
                {copy.hero.emailLead}{" "}
                <a href={`mailto:${EMAIL_GENERAL}`} className="focus-ring text-arepo-ink underline underline-offset-4">
                  {EMAIL_GENERAL}
                </a>
              </span>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <HeroArt />
          </div>
        </section>

        <ScrollTicker items={copy.ticker} />

        {/* Who we are: 2 portraits that unveil as you scroll. Dayyan left, Jack right. */}
        <section id="who" className={`${shell} py-20 sm:py-28`}>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <Reveal as="p" className={label}>
                {copy.who.label}
              </Reveal>
              <Reveal as="h2" delay={0.08} className={`mt-4 max-w-[14ch] ${h2}`}>
                {copy.who.title}
              </Reveal>
            </div>
            <ul className="grid gap-8 sm:grid-cols-2 lg:col-span-8 lg:col-start-5">
              {copy.who.people.map((p, i) => (
                <li key={p.name} className={i === 1 ? "sm:mt-16" : ""}>
                  <Portrait src={p.photo} alt={p.name} initials={p.initials} />
                  <Reveal delay={0.1} className="mt-5">
                    <h3 className="font-display text-2xl font-medium tracking-tight text-arepo-ink">{p.name}</h3>
                    <p className="mt-1 text-sm uppercase tracking-[0.14em] text-arepo-muted">{p.role}</p>
                    <p className="mt-3 max-w-[34ch] leading-relaxed text-arepo-ink2">{p.bio}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What we do: label left, 3 numbered rows right, hairlines between. */}
        <section id="what" className={`${shell} grid gap-10 border-t border-arepo-border py-20 sm:py-28 lg:grid-cols-12`}>
          <div className="lg:col-span-4">
            <Reveal as="p" className={label}>
              {copy.what.label}
            </Reveal>
            <Reveal as="h2" delay={0.08} className={`mt-4 max-w-[16ch] ${h2}`}>
              {copy.what.title}
            </Reveal>
          </div>
          <ol className="lg:col-span-8 lg:col-start-5">
            {copy.what.items.map((item, i) => (
              <Reveal as="li" key={item.title} delay={0.1 * i} className="grid gap-3 border-t border-arepo-border py-7 sm:grid-cols-[4rem_1fr] sm:gap-6">
                <span className="font-display text-sm font-medium text-arepo-accent">0{i + 1}</span>
                <div>
                  <h3 className="font-display text-2xl font-medium tracking-tight text-arepo-ink">{item.title}</h3>
                  <p className="mt-2 max-w-[48ch] leading-relaxed text-arepo-ink2">{item.body}</p>
                </div>
              </Reveal>
            ))}
            <li className="border-t border-arepo-border" aria-hidden="true" />
          </ol>
        </section>

        {/* How it works: 3 steps in a row on desktop, a column on a phone. Ink panel for contrast. */}
        <section className="bg-arepo-ink text-arepo-bg">
          <div className={`${shell} py-20 sm:py-28`}>
            <Reveal as="p" className={label}>
              {copy.how.label}
            </Reveal>
            <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {copy.how.steps.map((s, i) => (
                <Reveal as="li" key={s.title} delay={0.12 * i} className="border-t border-white/20 pt-6">
                  <span className="font-display text-sm text-arepo-accent">0{i + 1}</span>
                  <h3 className="mt-3 font-display text-2xl font-medium tracking-tight">{s.title}</h3>
                  <p className="mt-3 max-w-[34ch] leading-relaxed text-arepo-border">{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Contact: one big line, the general address, then each founder's own email and calendar
            as plain text links. The only booking button lives in the hero. */}
        <section id="contact" data-testid="final" className={`${shell} border-t border-arepo-border py-20 sm:py-28`}>
          <Reveal as="p" className={label}>
            {copy.contact.label}
          </Reveal>
          <Reveal as="h2" delay={0.08} className={`mt-4 max-w-[18ch] ${h2}`}>
            {copy.contact.title}
          </Reveal>
          <Reveal delay={0.16} className="mt-8">
            <a
              href={`mailto:${EMAIL_GENERAL}`}
              className="focus-ring font-display text-2xl font-medium tracking-tight text-arepo-ink underline decoration-arepo-accent decoration-2 underline-offset-8 hover:text-arepo-accent sm:text-4xl"
            >
              {EMAIL_GENERAL}
            </a>
            <p className="mt-5 text-arepo-muted">{copy.contact.body}</p>
          </Reveal>
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:max-w-[48rem]">
            {contacts.map((c, i) => (
              <Reveal as="li" key={c.email} delay={0.2 + 0.1 * i} className="border-t border-arepo-border pt-5">
                <p className="font-display text-lg font-medium tracking-tight text-arepo-ink">{c.name}</p>
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <a href={`mailto:${c.email}`} className="focus-ring text-arepo-ink underline underline-offset-4 hover:text-arepo-accent">
                    {c.email}
                  </a>
                  {c.calendly ? (
                    <a
                      href={c.calendly}
                      data-testid="calendar-link"
                      className="focus-ring text-arepo-muted underline underline-offset-4 hover:text-arepo-accent"
                    >
                      {copy.contact.calendarLabel}
                    </a>
                  ) : null}
                </p>
              </Reveal>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
