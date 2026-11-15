import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { PM } from "@/lib/paths";
import { CALENDLY, copy } from "@/content/agency/copy";

export function Header() {
  return (
    <header className="border-b border-arepo-border bg-arepo-surface">
      <div className="mx-auto flex w-full max-w-reading items-center justify-between gap-3 px-5 py-4">
        <span className="inline-flex items-center gap-2.5 text-arepo-ink">
          <LogoMark size={24} title="Arepo Labs" />
          <span className="font-display text-lg font-semibold tracking-wide">
            {copy.header.brand}
          </span>
        </span>
        <nav className="flex items-center gap-4">
          <Link
            href={PM}
            className="focus-ring hidden text-sm text-arepo-muted underline-offset-4 hover:text-arepo-ink hover:underline sm:inline"
          >
            {copy.header.research}
          </Link>
          <a
            href={CALENDLY}
            className="focus-ring rounded-card bg-arepo-accent px-3.5 py-2 text-sm font-medium text-arepo-accentFg hover:bg-arepo-accentHover"
          >
            Book a chat
          </a>
        </nav>
      </div>
    </header>
  );
}
