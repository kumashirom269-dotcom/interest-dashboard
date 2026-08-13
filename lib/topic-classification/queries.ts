import { createClient } from "@/lib/supabase/server";
import {
  FRESHNESS_PROFILE_DEFAULTS,
  type AudienceLevel,
  type FreshnessProfile,
  type InformationNeed,
  type TimeIntent,
  type TopicCandidateEntity,
  type TopicClassification,
  type TopicEntityType,
  type TopicIntentCategory,
  type TopicUnderstanding,
} from "./types";
import { TOPIC_KINDS, type TopicKind } from "@/lib/topic-identification/types";
import { isValidGenreId } from "@/lib/genres/definitions";
import { isValidInformationType } from "@/lib/genres/informationTypes";
import type { SourceType } from "@/types/domain";

function normalizeTopicKind(value: string | null): TopicKind {
  return value && (TOPIC_KINDS as string[]).includes(value) ? (value as TopicKind) : "unknown";
}

function normalizeGenreId(value: string | null): string {
  return value && isValidGenreId(value) ? value : "unknown";
}

function normalizeGenreIdArray(values: string[] | null): string[] {
  return (values ?? []).filter((v) => isValidGenreId(v));
}

function normalizeInformationTypeArray(values: string[] | null): string[] {
  return (values ?? []).filter((v) => isValidInformationType(v));
}

const SELECT_COLUMNS =
  "topic_id, topic_name, entity_type, parent_category, sub_category, detail_category, summary, intent_tags, recommended_source_types, search_keywords, confidence, needs_user_confirmation, ambiguity_reason, candidate_entities, research_hints, notes, identification_status, canonical_url, official_url, youtube_channel_url, freshness_profile, freshness_reason, min_refresh_interval_minutes, default_card_ttl_hours, time_intent, time_intent_reason, normalized_topic, entity_name, understanding_entity_type, intent_category, information_needs, priority_signals, negative_signals, search_hints, source_hints, audience_level, location_required, location_text, ambiguity_is_ambiguous, understanding_ambiguity_reason, candidate_meanings, user_intent_summary, topic_kind, primary_genre_id, secondary_genre_ids, auxiliary_genre_ids, information_types, cross_genre_tags, applied_cross_genre_rule_ids";

export interface TopicClassificationRow {
  topic_id: string;
  topic_name: string;
  entity_type: string;
  parent_category: string;
  sub_category: string;
  detail_category: string;
  summary: string | null;
  intent_tags: string[] | null;
  recommended_source_types: string[] | null;
  search_keywords: string[] | null;
  confidence: number;
  needs_user_confirmation: boolean;
  ambiguity_reason: string | null;
  candidate_entities: TopicCandidateEntity[] | null;
  research_hints: string[] | null;
  notes: string | null;
  identification_status: string | null;
  canonical_url: string | null;
  official_url: string | null;
  youtube_channel_url: string | null;
  freshness_profile: string | null;
  freshness_reason: string | null;
  min_refresh_interval_minutes: number | null;
  default_card_ttl_hours: number | null;
  time_intent: string | null;
  time_intent_reason: string | null;
  normalized_topic: string | null;
  entity_name: string | null;
  understanding_entity_type: string | null;
  intent_category: string | null;
  information_needs: string[] | null;
  priority_signals: string[] | null;
  negative_signals: string[] | null;
  search_hints: string[] | null;
  source_hints: string[] | null;
  audience_level: string | null;
  location_required: boolean | null;
  location_text: string | null;
  ambiguity_is_ambiguous: boolean | null;
  understanding_ambiguity_reason: string | null;
  candidate_meanings: string[] | null;
  user_intent_summary: string | null;
  topic_kind: string | null;
  primary_genre_id: string | null;
  secondary_genre_ids: string[] | null;
  auxiliary_genre_ids: string[] | null;
  information_types: string[] | null;
  cross_genre_tags: string[] | null;
  applied_cross_genre_rule_ids: string[] | null;
}

// このmigration（0021）より前に作成されたtopic_classifications行はfreshness系列がnullのため、
// "daily"を既定値としてフォールバックする（マイページの再収集判定を壊さないため）。
const DEFAULT_FRESHNESS_PROFILE: FreshnessProfile = "daily";
// time_intent未設定（0026より前の行）は、古い情報を誤って許可しないようcurrent_or_futureを既定にする。
const DEFAULT_TIME_INTENT: TimeIntent = "current_or_future";

function normalizeIntentCategory(value: string | null): TopicIntentCategory {
  const values: TopicIntentCategory[] = [
    "news", "event", "artist", "local", "learning", "technical", "entertainment",
    "food", "shopping", "career", "finance", "health", "evergreen_knowledge", "other",
  ];
  return value && (values as string[]).includes(value) ? (value as TopicIntentCategory) : "other";
}

function normalizeAudienceLevel(value: string | null): AudienceLevel {
  const values: AudienceLevel[] = ["beginner", "general", "enthusiast", "expert", "unknown"];
  return value && (values as string[]).includes(value) ? (value as AudienceLevel) : "unknown";
}

// 0027より前に作成された行（understanding系列が未設定）に対する安全なフォールバック。
function mapUnderstanding(row: TopicClassificationRow): TopicUnderstanding {
  return {
    topicKind: normalizeTopicKind(row.topic_kind),
    normalizedTopic: row.normalized_topic ?? row.topic_name,
    entityName: row.entity_name,
    entityType: row.understanding_entity_type,
    primaryGenreId: normalizeGenreId(row.primary_genre_id),
    secondaryGenreIds: normalizeGenreIdArray(row.secondary_genre_ids),
    auxiliaryGenreIds: normalizeGenreIdArray(row.auxiliary_genre_ids),
    informationTypes: normalizeInformationTypeArray(row.information_types),
    crossGenreTags: row.cross_genre_tags ?? [],
    appliedCrossGenreRuleIds: row.applied_cross_genre_rule_ids ?? [],
    category: normalizeIntentCategory(row.intent_category),
    informationNeeds: (row.information_needs ?? []) as InformationNeed[],
    prioritySignals: row.priority_signals ?? [],
    negativeSignals: row.negative_signals ?? [],
    searchHints: row.search_hints ?? [],
    sourceHints: row.source_hints ?? [],
    audienceLevel: normalizeAudienceLevel(row.audience_level),
    locationIntent: {
      required: row.location_required ?? false,
      locationText: row.location_text,
    },
    ambiguity: {
      isAmbiguous: row.ambiguity_is_ambiguous ?? false,
      reason: row.understanding_ambiguity_reason,
      candidateMeanings: row.candidate_meanings ?? [],
    },
    userIntentSummary: row.user_intent_summary ?? row.topic_name,
  };
}

export function mapRow(row: TopicClassificationRow): TopicClassification {
  const freshnessProfile = (row.freshness_profile as FreshnessProfile | null) ?? DEFAULT_FRESHNESS_PROFILE;
  const freshnessDefaults = FRESHNESS_PROFILE_DEFAULTS[freshnessProfile];

  return {
    topicName: row.topic_name,
    entityType: row.entity_type as TopicEntityType,
    parentCategory: row.parent_category,
    subCategory: row.sub_category,
    detailCategory: row.detail_category,
    summary: row.summary ?? "",
    intentTags: row.intent_tags ?? [],
    recommendedSourceTypes: (row.recommended_source_types ?? []) as SourceType[],
    searchKeywords: row.search_keywords ?? [],
    confidence: row.confidence,
    needsUserConfirmation: row.needs_user_confirmation,
    ambiguityReason: row.ambiguity_reason ?? undefined,
    candidateEntities: row.candidate_entities ?? [],
    researchHints: row.research_hints ?? [],
    notes: row.notes ?? undefined,
    identificationStatus:
      (row.identification_status as TopicClassification["identificationStatus"]) ??
      undefined,
    canonicalUrl: row.canonical_url,
    officialUrl: row.official_url,
    youtubeChannelUrl: row.youtube_channel_url,
    freshnessProfile,
    freshnessReason: row.freshness_reason ?? "",
    minRefreshIntervalMinutes:
      row.min_refresh_interval_minutes ?? freshnessDefaults.minRefreshIntervalMinutes,
    defaultCardTtlHours: row.default_card_ttl_hours ?? freshnessDefaults.defaultCardTtlHours,
    timeIntent: (row.time_intent as TimeIntent | null) ?? DEFAULT_TIME_INTENT,
    timeIntentReason: row.time_intent_reason ?? "",
    understanding: mapUnderstanding(row),
  };
}

export async function getTopicClassificationsForUser(): Promise<
  Record<string, TopicClassification>
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_classifications")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id);

  if (error) throw error;

  const map: Record<string, TopicClassification> = {};
  for (const row of data ?? []) {
    const typedRow = row as unknown as TopicClassificationRow;
    map[typedRow.topic_id] = mapRow(typedRow);
  }
  return map;
}

export async function getTopicClassificationForTopic(
  topicId: string,
): Promise<TopicClassification | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("topic_classifications")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapRow(data as unknown as TopicClassificationRow);
}

// topic_idを一意キーとしてupsertする。1トピックにつき最新の分類結果のみを保持する設計。
export async function upsertTopicClassification(
  topicId: string,
  classification: TopicClassification,
  rawResult: unknown,
): Promise<TopicClassification> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // identificationStatus等は、対象特定ゲート（confirmTopicRegistration）を経由した
  // 場合のみclassificationに含まれる。手動の「AIで分類」再実行時（classifyTopicAction）は
  // これらがundefinedのままなので、payloadに含めず、DB上の既存値を上書きしないようにする
  // （Supabaseのupsertは、payloadに含めた列だけをON CONFLICT時に更新するため）。
  const identificationFields =
    classification.identificationStatus !== undefined
      ? {
          identification_status: classification.identificationStatus,
          canonical_url: classification.canonicalUrl ?? null,
          official_url: classification.officialUrl ?? null,
          youtube_channel_url: classification.youtubeChannelUrl ?? null,
        }
      : {};

  const { data, error } = await supabase
    .from("topic_classifications")
    .upsert(
      {
        user_id: user.id,
        topic_id: topicId,
        topic_name: classification.topicName,
        entity_type: classification.entityType,
        parent_category: classification.parentCategory,
        sub_category: classification.subCategory,
        detail_category: classification.detailCategory,
        summary: classification.summary,
        intent_tags: classification.intentTags,
        recommended_source_types: classification.recommendedSourceTypes,
        search_keywords: classification.searchKeywords,
        confidence: classification.confidence,
        needs_user_confirmation: classification.needsUserConfirmation,
        ambiguity_reason: classification.ambiguityReason ?? null,
        candidate_entities: classification.candidateEntities,
        research_hints: classification.researchHints,
        notes: classification.notes ?? null,
        raw_result: rawResult,
        freshness_profile: classification.freshnessProfile,
        freshness_reason: classification.freshnessReason,
        min_refresh_interval_minutes: classification.minRefreshIntervalMinutes,
        default_card_ttl_hours: classification.defaultCardTtlHours,
        time_intent: classification.timeIntent,
        time_intent_reason: classification.timeIntentReason,
        normalized_topic: classification.understanding.normalizedTopic,
        entity_name: classification.understanding.entityName,
        understanding_entity_type: classification.understanding.entityType,
        intent_category: classification.understanding.category,
        information_needs: classification.understanding.informationNeeds,
        priority_signals: classification.understanding.prioritySignals,
        negative_signals: classification.understanding.negativeSignals,
        search_hints: classification.understanding.searchHints,
        source_hints: classification.understanding.sourceHints,
        audience_level: classification.understanding.audienceLevel,
        location_required: classification.understanding.locationIntent.required,
        location_text: classification.understanding.locationIntent.locationText,
        ambiguity_is_ambiguous: classification.understanding.ambiguity.isAmbiguous,
        understanding_ambiguity_reason: classification.understanding.ambiguity.reason,
        candidate_meanings: classification.understanding.ambiguity.candidateMeanings,
        user_intent_summary: classification.understanding.userIntentSummary,
        topic_kind: classification.understanding.topicKind,
        primary_genre_id: classification.understanding.primaryGenreId,
        secondary_genre_ids: classification.understanding.secondaryGenreIds,
        auxiliary_genre_ids: classification.understanding.auxiliaryGenreIds,
        information_types: classification.understanding.informationTypes,
        cross_genre_tags: classification.understanding.crossGenreTags,
        applied_cross_genre_rule_ids: classification.understanding.appliedCrossGenreRuleIds,
        ...identificationFields,
      },
      { onConflict: "topic_id" },
    )
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw error;

  return mapRow(data as unknown as TopicClassificationRow);
}
