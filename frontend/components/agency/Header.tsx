import { LogoMark } from "@/components/Logo";
import { copy } from "@/content/agency/copy";

/** Top bar: wordmark left, 3 in-page links right. No booking button here: the page has exactly 1. */
export function Header() {
  return (
    <header className="sticky top-0 z-20 bg-arepo-accent text-white shadow-arepo-card">
      <div className="mx-auto flex w-full max-w-shell h-16 items-center justify-between gap-2.5 px-4 sm:h-[88px] sm:gap-4 sm:px-10">
        <a
          href="#top"
          aria-label="Arepo Labs"
          className="focus-ring inline-flex shrink-0 items-center gap-2 rounded-lg bg-black px-2 py-1.5 text-white sm:gap-4 sm:px-4 sm:py-2.5"
        >
          <span className="block h-[26px] w-[26px] shrink-0 sm:h-9 sm:w-9 [&>svg]:h-full [&>svg]:w-full">
            <LogoMark size={36} variant="dark" />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/arepo-wordmark.png" alt="" width={882} height={146} className="hidden h-3 w-auto shrink-0 min-[370px]:block sm:h-[22px]" />
          <span className="hidden font-display text-base font-medium uppercase tracking-[0.3em] sm:inline">Labs</span>
        </a>
        <nav aria-label="Sections" className="flex items-center gap-3 whitespace-nowrap text-[13px] font-medium text-white sm:gap-8 sm:text-base">
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
