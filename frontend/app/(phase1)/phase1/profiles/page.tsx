import { copy } from "@/content/agency/copy";
import { mergeProfiles, type ProfileRow } from "@/lib/site/profiles";
import { createServiceClient } from "@/lib/phase1/supabase";
import { isTestMode } from "@/lib/phase1/allowlist";
import { ProfilesForm } from "./ProfilesForm";

export const dynamic = "force-dynamic";

async function savedRows(): Promise<ProfileRow[]> {
  if (isTestMode()) return [];
  try {
    const { data } = await createServiceClient().from("site_profiles").select("*");
    return (data ?? []) as ProfileRow[];
  } catch {
    return [];
  }
}

export default async function Page() {
  const people = mergeProfiles(copy.who.people, await savedRows());
  return (
    <section>
      <h1 className="text-xl font-medium text-arepo-ink">Profiles</h1>
      <p className="mt-2 max-w-reading text-arepo-muted">
        The two founder profiles in the Who we are section on the public page. Empty fields fall back to the original wording.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ProfilesForm slug="dayyan" initial={people[0]!} />
        <ProfilesForm slug="jack" initial={people[1]!} />
      </div>
    </section>
  );
}
