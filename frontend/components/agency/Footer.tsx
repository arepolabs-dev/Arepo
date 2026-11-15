import Link from "next/link";
import { PM } from "@/lib/paths";
import { EMAIL, copy } from "@/content/agency/copy";

export function Footer() {
  return (
    <footer className="border-t border-arepo-border bg-arepo-surface">
      <div className="mx-auto w-full max-w-reading space-y-1.5 px-5 py-8 text-sm text-arepo-muted">
        <p>{copy.footer.line}</p>
        <p>
          <a href={`mailto:${EMAIL}`} className="focus-ring underline underline-offset-4">
            {EMAIL}
          </a>
        </p>
        <p>{copy.footer.legal}</p>
        <p>
          <Link href={PM} className="focus-ring underline underline-offset-4">
            {copy.footer.research}
          </Link>
        </p>
      </div>
    </footer>
  );
}
