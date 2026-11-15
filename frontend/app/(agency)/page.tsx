import { Banner, Header } from "@/components/agency/Header";
import { HeroArt, Portrait, Reveal, ScrollTicker } from "@/components/agency/motion";
import { CALENDLY, EMAIL_GENERAL, copy } from "@/content/agency/copy";

/*
 * Agency landing page. Editorial, left-aligned, a 12-column grid on desktop that stacks on a phone.
 * Native scrolling. 1 primary booking button (hero, Arepo red); Contact lists each founder's email
 * and calendar as plain text links. No prices, no "Recent work", no footer, no link to /predictionmarket.
 * Order (Dayyan, 15 Nov): hero, ticker, Who we are, What we do, Custom, How it works, Contact.
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
                    <p className="mt-1 max-w-[34ch] text-xs uppercase tracking-[0.12em] text-arepo-accent">{p.role}</p>
                    <p className="mt-3 max-w-[34ch] font-medium leading-relaxed text-arepo-ink">{p.bio}</p>
                    <p className="mt-2 max-w-[36ch] text-sm leading-relaxed text-arepo-ink2">{p.proof}</p>
                    <p className="mt-4 flex flex-col gap-1 text-sm">
                      <a href={`mailto:${p.email}`} className="focus-ring w-fit text-arepo-ink underline underline-offset-4 hover:text-arepo-accent">
                        {p.email}
                      </a>
                      {p.calendly ? (
                        <a
                          href={p.calendly}
                          data-testid="calendar-link"
                          className="focus-ring w-fit text-arepo-muted underline underline-offset-4 hover:text-arepo-accent"
                        >
                          {copy.contact.calendarLabel}
                        </a>
                      ) : null}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* What we do: 3 bold cards, each with a red top bar and a big red number. */}
        <section id="what" className={`${shell} border-t border-arepo-border py-20 sm:py-28`}>
          <Reveal as="p" className={label}>
            {copy.what.label}
          </Reveal>
          <Reveal as="h2" delay={0.08} className={`mt-4 max-w-[18ch] ${h2}`}>
            {copy.what.title}
          </Reveal>
          <ol className="mt-12 grid gap-6 lg:grid-cols-3">
            {copy.what.items.map((item, i) => (
              <Reveal
                as="li"
                key={item.title}
                delay={0.1 * i}
                className="flex flex-col border-2 border-arepo-ink border-t-[10px] border-t-arepo-accent bg-arepo-bg p-7 sm:p-8"
              >
                <span className="font-display text-7xl font-bold leading-none tracking-tight text-arepo-accent">0{i + 1}</span>
                <h3 className="mt-6 font-display text-3xl font-bold leading-[1.05] tracking-tight text-arepo-ink">{item.title}</h3>
                <p className="mt-4 text-lg font-medium leading-snug text-arepo-ink2">{item.body}</p>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* Custom: boutique workflows beyond the 3 jobs. */}
        <section data-testid="custom" className="border-y border-arepo-border bg-arepo-surface2">
          <div className={`${shell} grid items-center gap-8 py-16 sm:py-20 lg:grid-cols-12`}>
            <div className="lg:col-span-7">
              <Reveal as="p" className={label}>
                {copy.custom.label}
              </Reveal>
              <Reveal as="h2" delay={0.08} className={`mt-4 max-w-[18ch] ${h2}`}>
                {copy.custom.title}
              </Reveal>
              <Reveal as="p" delay={0.16} className="mt-5 max-w-[52ch] text-lg leading-relaxed text-arepo-ink2">
                {copy.custom.body}
              </Reveal>
            </div>
            <Reveal delay={0.2} className="lg:col-span-5">
              <ul className="flex flex-wrap gap-3">
                {copy.custom.examples.map((x) => (
                  <li key={x} className="border-2 border-arepo-ink px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-arepo-ink">
                    {x}
                  </li>
                ))}
                <li className="border-2 border-arepo-accent bg-arepo-accent px-4 py-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-arepo-accentFg">
                  Your idea
                </li>
              </ul>
            </Reveal>
          </div>
        </section>

        {/* How it works: 3 big numbered steps on an ink panel with red accents. */}
        <section className="bg-arepo-ink text-arepo-bg">
          <div className={`${shell} py-20 sm:py-28`}>
            <Reveal as="p" className={label}>
              {copy.how.label}
            </Reveal>
            <ol className="mt-12 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {copy.how.steps.map((s, i) => (
                <Reveal as="li" key={s.title} delay={0.12 * i} className="border-t-[6px] border-arepo-accent pt-6">
                  <span className="block font-display text-8xl font-bold leading-none tracking-tight text-arepo-accent sm:text-9xl">
                    {i + 1}
                  </span>
                  <h3 className="mt-6 font-display text-3xl font-bold leading-[1.05] tracking-tight text-white">{s.title}</h3>
                  <p className="mt-4 max-w-[34ch] text-lg leading-relaxed text-white/85">{s.body}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* Contact: the line and the booking part on the left, the contact details on the right
            (stacked on a phone). Each founder's own email and calendar live under Who we are. */}
        <section id="contact" data-testid="final" className={`${shell} border-t border-arepo-border py-20 sm:py-28`}>
          <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              <Reveal as="p" className={label}>
                {copy.contact.label}
              </Reveal>
              <Reveal as="h2" delay={0.08} className={`mt-4 max-w-[18ch] ${h2}`}>
                {copy.contact.title}
              </Reveal>
              <Reveal delay={0.16} className="mt-8">
                <p className="max-w-[44ch] text-lg leading-relaxed text-arepo-ink2">{copy.contact.body}</p>
                <a
                  href={CALENDLY}
                  className="focus-ring mt-5 inline-block font-display text-xl font-semibold text-arepo-ink underline decoration-arepo-accent decoration-2 underline-offset-8 hover:text-arepo-accent"
                >
                  {copy.contact.bookLabel}
                </a>
              </Reveal>
            </div>
            <Reveal delay={0.2} className="border-2 border-arepo-ink border-t-[10px] border-t-arepo-accent p-7 lg:col-span-5">
              <p className="font-display text-xs font-medium uppercase tracking-[0.22em] text-arepo-muted">{copy.contact.detailsLabel}</p>
              <a
                href={`mailto:${EMAIL_GENERAL}`}
                className="focus-ring mt-4 block break-all font-display text-2xl font-semibold tracking-tight text-arepo-ink underline decoration-arepo-accent decoration-2 underline-offset-8 hover:text-arepo-accent"
              >
                {EMAIL_GENERAL}
              </a>
              <p className="mt-4 text-arepo-muted">{copy.contact.areaLine}</p>
            </Reveal>
          </div>
        </section>
      </main>
    </>
  );
}
