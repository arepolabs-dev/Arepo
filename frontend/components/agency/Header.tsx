import { LogoMark } from "@/components/Logo";
import { copy } from "@/content/agency/copy";

/** Top bar: wordmark left, 3 in-page links right. No booking button here: the page has exactly 1. */
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-arepo-border/80 bg-arepo-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-shell items-center justify-between gap-4 px-5 py-4 sm:px-10">
        <a href="#top" className="focus-ring inline-flex items-center gap-2.5 text-arepo-ink">
          <LogoMark size={22} title="Arepo Labs" />
          <span className="font-display text-base font-semibold uppercase tracking-[0.18em]">
            {copy.nav.brand}
          </span>
        </a>
        <nav aria-label="Sections" className="flex items-center gap-5 text-sm text-arepo-muted sm:gap-8">
          {copy.nav.links.map((l) => (
            <a key={l.href} href={l.href} className="focus-ring hover:text-arepo-ink">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
