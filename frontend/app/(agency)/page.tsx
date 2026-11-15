import { Header } from "@/components/agency/Header";
import { Footer } from "@/components/agency/Footer";
import { CALENDLY, EMAIL, copy } from "@/content/agency/copy";

const button =
  "focus-ring inline-block rounded-card bg-arepo-accent px-5 py-3 text-base font-medium text-arepo-accentFg hover:bg-arepo-accentHover";
const h2 = "font-display text-2xl font-semibold text-arepo-ink";
const card = "rounded-card border border-arepo-border bg-arepo-surface p-5 shadow-arepo-card";

export default function AgencyPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-reading flex-1 space-y-14 px-5 py-10 sm:py-14">
        <section data-testid="hero" className="space-y-5">
          <h1 className="font-display text-4xl font-semibold leading-tight text-arepo-ink sm:text-5xl">
            {copy.hero.h1}
          </h1>
          <p className="text-lg leading-relaxed text-arepo-ink2">{copy.hero.sub}</p>
          <div className="space-y-3">
            <a href={CALENDLY} className={button}>
              {copy.hero.cta}
            </a>
            <p className="text-sm text-arepo-muted">
              {copy.hero.emailLead}{" "}
              <a href={`mailto:${EMAIL}`} className="focus-ring underline underline-offset-4">
                {EMAIL}
              </a>
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className={h2}>{copy.fix.title}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {copy.fix.cards.map((c) => (
              <div key={c.title} className={card}>
                <h3 className="font-medium text-arepo-ink">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-arepo-ink2">{c.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-card bg-arepo-accentTint p-5">
          <h2 className={h2}>{copy.saves.title}</h2>
          <p className="leading-relaxed text-arepo-ink2">{copy.saves.body}</p>
        </section>

        <section className="space-y-4">
          <h2 className={h2}>{copy.how.title}</h2>
          <ol className="space-y-3">
            {copy.how.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-xl font-semibold text-arepo-accent">{i + 1}</span>
                <span className="leading-relaxed text-arepo-ink2">{s}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-4">
          <h2 className={h2}>{copy.different.title}</h2>
          <ul className="list-disc space-y-2 pl-5 leading-relaxed text-arepo-ink2">
            {copy.different.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className={h2}>{copy.work.title}</h2>
          <div className={card}>
            <h3 className="font-medium text-arepo-ink">{copy.work.card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-arepo-ink2">{copy.work.card.body}</p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className={h2}>{copy.who.title}</h2>
          <ul className="space-y-2 text-arepo-ink2">
            {copy.who.people.map((p) => (
              <li key={p.name}>
                <span className="font-medium text-arepo-ink">{p.name}</span>, {p.bio}
              </li>
            ))}
          </ul>
          <p className="text-arepo-ink2">{copy.who.area}</p>
        </section>

        <section data-testid="final" className="space-y-4 border-t border-arepo-border pt-10">
          <h2 className={h2}>{copy.final.title}</h2>
          <a href={CALENDLY} className={button}>
            {copy.final.cta}
          </a>
          <p className="text-arepo-ink2">{copy.final.warm}</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
