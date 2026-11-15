import { LogoMark } from "@/components/Logo";
import { copy } from "@/content/agency/copy";

/**
 * Slim announcement strip at the very top: 1 line of text on ink, plus an in-page link to Contact.
 * It scrolls away with the page; the sticky nav below it takes over. No booking button here.
 */
export function Banner() {
  return (
    <div data-testid="banner" className="bg-arepo-ink text-arepo-bg">
      <p className="mx-auto flex w-full max-w-shell flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center text-xs tracking-[0.04em] sm:px-10 sm:text-sm">
        <span>{copy.banner.text}</span>
        <a
          href={copy.banner.href}
          className="focus-ring underline decoration-arepo-accent decoration-2 underline-offset-4 hover:text-white"
        >
          {copy.banner.linkLabel}
        </a>
      </p>
    </div>
  );
}

/** Top bar: wordmark left, 3 in-page links right. No booking button here: the page has exactly 1. */
export function Header() {
  return (
    <header className="sticky top-0 z-20 bg-arepo-accent text-white shadow-arepo-card">
      <div className="mx-auto flex w-full max-w-shell h-16 items-center justify-between gap-4 px-5 sm:h-[88px] sm:px-10">
        <a href="#top" className="focus-ring inline-flex items-center gap-3 text-white">
          <LogoMark size={40} stroke={3} onRed title="Arepo Labs" />
          <span className="font-display text-lg font-semibold uppercase tracking-[0.18em] sm:text-xl">
            {copy.nav.brand}
          </span>
        </a>
        <nav aria-label="Sections" className="flex items-center gap-4 text-sm font-medium text-white sm:gap-8 sm:text-base">
          {copy.nav.links.map((l) => (
            <a key={l.href} href={l.href} className="focus-ring underline-offset-8 hover:underline hover:decoration-2">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
