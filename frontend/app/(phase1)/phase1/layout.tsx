import { Shell } from "@/components/phase1/Shell";
import { getSession } from "@/lib/phase1/supabase";

// Session-dependent: never prerender any /phase1 page at build time.
export const dynamic = "force-dynamic";

// Signed-in pages get the shell (tabs, initials, sign out); the sign-in page renders bare.
export default async function Phase1Layout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (s.state !== "ok") return <>{children}</>;
  return (
    <Shell initials={s.user.initials} email={s.user.email}>
      {children}
    </Shell>
  );
}
