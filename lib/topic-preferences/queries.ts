import { createClient } from "@/lib/supabase/server";
import type {
  GeneratedPreferenceCategory,
  PreferenceCategoryType,
  PreferenceSource,
  TopicPreferenceCategory,
} from "./types";

const SELECT_COLUMNS =
  "id, topic_id, label, description, category_type, preference_key, is_selected, priority, ai_generated, source, visible_to_user, weight, negative_weight, display_order, created_at, updated_at";

interface TopicPreferenceCategoryRow {
  id: string;
  topic_id: string;
  label: string;
  description: string | null;
  category_type: string;
  preference_key: string;
  is_selected: boolean;
  priority: number;
  ai_generated: boolean;
  source: string;
  visible_to_user: boolean;
  weight: number | null;
  negative_weight: number | null;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: TopicPreferenceCategoryRow): TopicPreferenceCategory {
  return {
    id: row.id,
    topicId: row.topic_id,
    label: row.label,
    description: row.description ?? "",
    categoryType: row.category_type as PreferenceCategoryType,
    preferenceKey: row.preference_key,
    isSelected: row.is_selected,
    priority: row.priority,
    aiGenerated: row.ai_generated,
    source: row.source as PreferenceSource,
    visibleToUser: row.visible_to_user,
    weight: row.weight,
    negativeWeight: row.negative_weight,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTopicPreferenceCategoriesForUser(): Promise<
  Record<string, TopicPreferenceCategory[]>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_preferences")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .order("priority", { ascending: false });

  if (error) throw error;

  const map: Record<string, TopicPreferenceCategory[]> = {};
  for (const row of data ?? []) {
    const typedRow = row as unknown as TopicPreferenceCategoryRow;
    const list = map[typedRow.topic_id] ?? [];
    list.push(mapRow(typedRow));
    map[typedRow.topic_id] = list;
  }
  return map;
}

export async function getTopicPreferenceCategoriesForTopic(
  topicId: string,
): Promise<TopicPreferenceCategory[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_preferences")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .order("priority", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row as unknown as TopicPreferenceCategoryRow));
}

// トピック登録確認画面でユーザーが確定したカテゴリ一覧を、新規トピックに紐づけて一括保存する。
// topic_idはtopics行作成後にしか分からないため、必ずトピック作成の直後に呼び出す。
export async function insertTopicPreferenceCategories(
  topicId: string,
  categories: GeneratedPreferenceCategory[],
): Promise<TopicPreferenceCategory[]> {
  if (categories.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_preferences")
    .insert(
      categories.map((c) => ({
        user_id: user.id,
        topic_id: topicId,
        label: c.label,
        description: c.description,
        category_type: c.categoryType,
        preference_key: c.preferenceKey,
        is_selected: c.isSelected,
        priority: c.priority,
        ai_generated: true,
        source: "ai" as PreferenceSource,
      })),
    )
    .select(SELECT_COLUMNS);

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row as unknown as TopicPreferenceCategoryRow));
}
