import { createClient } from "@/lib/supabase/server";
import { getSourcesForUser } from "@/lib/sources/queries";
import { SourcesPageClient } from "./SourcesPageClient";

export default async function SourcesPage() {
  const sources = await getSourcesForUser();

  const supabase = await createClient();
  const { data: topics, error } = await supabase
    .from("topics")
    .select("id, name")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SourcesPageClient initialSources={sources} topics={topics ?? []} />
    </div>
  );
}
