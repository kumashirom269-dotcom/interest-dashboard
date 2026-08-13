import { createClient } from "@/lib/supabase/server";
import type {
  DesiredContentType,
  DisplayTone,
  ExcludedTendency,
  TargetLevel,
  TopicPreferenceSettings,
} from "./types";

const SELECT_COLUMNS =
  "topic_id, target_level, desired_content_types, display_tone, excluded_tendencies, supplementary_notes, user_focus";

interface TopicPreferenceSettingsRow {
  topic_id: string;
  target_level: string;
  desired_content_types: string[] | null;
  display_tone: string;
  excluded_tendencies: string[] | null;
  supplementary_notes: string | null;
  user_focus: string | null;
}

function mapRow(row: TopicPreferenceSettingsRow): TopicPreferenceSettings {
  return {
    topicId: row.topic_id,
    targetLevel: row.target_level as TargetLevel,
    desiredContentTypes: (row.desired_content_types ?? []) as DesiredContentType[],
    displayTone: row.display_tone as DisplayTone,
    excludedTendencies: (row.excluded_tendencies ?? []) as ExcludedTendency[],
    supplementaryNotes: row.supplementary_notes ?? "",
    userFocus: row.user_focus ?? "",
  };
}

export async function getTopicPreferenceSettingsForUser(): Promise<
  Record<string, TopicPreferenceSettings>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_preference_settings")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id);

  if (error) throw error;

  const map: Record<string, TopicPreferenceSettings> = {};
  for (const row of data ?? []) {
    const typedRow = row as unknown as TopicPreferenceSettingsRow;
    map[typedRow.topic_id] = mapRow(typedRow);
  }
  return map;
}

export async function getTopicPreferenceSettingsForTopic(
  topicId: string,
): Promise<TopicPreferenceSettings | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_preference_settings")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapRow(data as unknown as TopicPreferenceSettingsRow);
}

export interface TopicPreferenceSettingsInput {
  targetLevel: TargetLevel;
  desiredContentTypes: DesiredContentType[];
  displayTone: DisplayTone;
  excludedTendencies: ExcludedTendency[];
  supplementaryNotes: string;
  userFocus: string;
}

// topic_idを一意キーとしてupsertする。1トピックにつき最新の設定のみを保持する。
export async function upsertTopicPreferenceSettings(
  topicId: string,
  input: TopicPreferenceSettingsInput,
): Promise<TopicPreferenceSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_preference_settings")
    .upsert(
      {
        user_id: user.id,
        topic_id: topicId,
        target_level: input.targetLevel,
        desired_content_types: input.desiredContentTypes,
        display_tone: input.displayTone,
        excluded_tendencies: input.excludedTendencies,
        supplementary_notes: input.supplementaryNotes,
        user_focus: input.userFocus,
      },
      { onConflict: "topic_id" },
    )
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;

  return mapRow(data as unknown as TopicPreferenceSettingsRow);
}
