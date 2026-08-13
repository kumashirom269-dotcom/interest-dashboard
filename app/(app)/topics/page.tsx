import { createClient } from "@/lib/supabase/server";
import { getSourcesForUser } from "@/lib/sources/queries";
import { getTopicClassificationsForUser } from "@/lib/topic-classification/queries";
import { getTopicPreferenceSettingsForUser } from "@/lib/topic-preference-settings/queries";
import { getTopicPreferenceCategoriesForUser } from "@/lib/topic-preferences/queries";
import { TopicsPageClient } from "./TopicsPageClient";
import type { Topic } from "@/types/domain";

export default async function TopicsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const topics: Topic[] = (data ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? "",
    keywords: row.keywords ?? [],
    last_collected_at: row.last_collected_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const [sources, classifications, preferenceSettings, preferenceCategories] =
    await Promise.all([
      getSourcesForUser(),
      getTopicClassificationsForUser(),
      getTopicPreferenceSettingsForUser(),
      getTopicPreferenceCategoriesForUser(),
    ]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <TopicsPageClient
        initialTopics={topics}
        initialSources={sources}
        initialClassifications={classifications}
        initialPreferenceSettings={preferenceSettings}
        initialPreferenceCategories={preferenceCategories}
      />
    </div>
  );
}
