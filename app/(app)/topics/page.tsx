import { createClient } from "@/lib/supabase/server";
import { getSourcesForUser } from "@/lib/sources/queries";
import { getTopicClassificationsForUser } from "@/lib/topic-classification/queries";
import { getTopicPreferenceSettingsForUser } from "@/lib/topic-preference-settings/queries";
import { getTopicPreferenceCategoriesForUser } from "@/lib/topic-preferences/queries";
import { TopicsPageClient } from "./TopicsPageClient";
import { FollowedAntennaList } from "@/components/topics/FollowedAntennaList";
import { getFollowedTopicsForUser } from "./actions";
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
    is_public: row.is_public ?? false,
    slug: row.slug,
    public_title: row.public_title,
    public_description: row.public_description,
    published_at: row.published_at,
    copied_from_topic_id: row.copied_from_topic_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const [sources, classifications, preferenceSettings, preferenceCategories, followedTopics] =
    await Promise.all([
      getSourcesForUser(),
      getTopicClassificationsForUser(),
      getTopicPreferenceSettingsForUser(),
      getTopicPreferenceCategoriesForUser(),
      getFollowedTopicsForUser(),
    ]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <FollowedAntennaList initialFollowedTopics={followedTopics} />
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
