"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phase1Provider } from "./data";

export const PHASE1_TABS = [
  { href: "/phase1", label: "Phases" },
  { href: "/phase1/replies", label: "Replies" },
  { href: "/phase1/prospects", label: "Prospects" },
] as const;

function isActive(path: string, href: string): boolean {
  return href === "/phase1" ? path === "/phase1" : path === href || path.startsWith(href + "/");
}

export function Shell({
  initials,
  email,
  children,
}: {
  initials: string;
  email: string;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "/phase1";
  return (
    <>
      <header className="border-b border-arepo-border bg-arepo-surface">
        <div className="mx-auto flex w-full max-w-shell items-center gap-6 px-5 sm:px-8 lg:px-12">
          <Link
            href="/phase1"
            className="font-display text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-arepo-ink py-4 shrink-0"
          >
            Phase 1
          </Link>
          <nav aria-label="Phase 1" className="flex-1 min-w-0 overflow-x-auto">
            <ul className="flex gap-1 whitespace-nowrap">
              {PHASE1_TABS.map((t) => {
                const active = isActive(path, t.href);
                return (
                  <li key={t.href}>
                    <Link
                      href={t.href}
                      aria-current={active ? "page" : undefined}
                      className={`block px-3 py-4 text-sm border-b-2 transition-colors ${
                        active
                          ? "border-arepo-accent text-arepo-ink font-medium"
                          : "border-transparent text-arepo-muted hover:text-arepo-ink"
                      }`}
                    >
                      {t.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <span
              title={email}
              data-testid="phase1-initials"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-arepo-surface2 border border-arepo-border text-xs font-medium text-arepo-ink2"
            >
              {initials}
            </span>
            <form method="post" action="/phase1/api/auth/signout">
              <button type="submit" className="text-sm text-arepo-muted hover:text-arepo-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-shell flex-1 px-5 py-8 sm:px-8 lg:px-12">
        <Phase1Provider>{children}</Phase1Provider>
      </main>
    </>
  );
}

/** Calm empty state for tabs a later package fills in. */
export function Placeholder({ title, line }: { title: string; line: string }) {
  return (
    <section className="max-w-reading">
      <h1 className="text-xl font-medium text-arepo-ink">{title}</h1>
      <p className="mt-2 text-arepo-muted">{line}</p>
    </section>
  );
}
