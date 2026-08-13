import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapSourceRow,
  type SourceRow,
  type SourceWithTopic,
} from "@/lib/sources/queries";
import {
  mapFeedItemRow,
  type FeedItemRow,
  type FeedItemWithMeta,
} from "@/lib/feed-items/queries";
import { mapRow as mapTopicClassificationRow } from "@/lib/topic-classification/queries";
import type { TopicClassificationRow } from "@/lib/topic-classification/queries";
import type { TopicClassification } from "@/lib/topic-classification/types";
import type { ReactionType } from "@/types/domain";

export interface DebugTopic {
  id: string;
  name: string;
  description: string | null;
  keywords: string[] | null;
  last_collected_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DebugTopicClassification = TopicClassification & { topicId: string };

// このモジュールのクエリは、apiKeyHashが渡された場合はdebug用のSECURITY DEFINER関数
// （supabase/migrations/0013_debug_api_access.sql）をRPC経由で呼び出し、
// それ以外（Cookieセッション・開発環境）は通常のテーブルクエリ（RLSでスコープ）を使う。
// RPC関数はhash照合とuser_id絞り込みをDB内部で完結させるため、
// ここではapplication側でuser_idによる絞り込みを一切行わない。

interface ReactionRow {
  feed_item_id: string;
  reaction_type: string;
}

async function loadReactionsByFeedItem(
  supabase: SupabaseClient,
  apiKeyHash: string | undefined,
): Promise<Record<string, ReactionType[]>> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_reactions", { p_api_key_hash: apiKeyHash })
    : await supabase.from("reactions").select("feed_item_id, reaction_type")) as {
    data: ReactionRow[] | null;
    error: { message: string } | null;
  };
  if (error) throw error;

  const map: Record<string, ReactionType[]> = {};
  for (const row of data ?? []) {
    const list = map[row.feed_item_id] ?? [];
    list.push(row.reaction_type as ReactionType);
    map[row.feed_item_id] = list;
  }
  return map;
}

export async function listDebugTopics(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugTopic[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_topics", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("topics")
        .select("id, name, description, keywords, last_collected_at, created_at, updated_at")
        .order("created_at", { ascending: true })) as {
    data: DebugTopic[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}

export async function listDebugSources(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<SourceWithTopic[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_sources", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("sources")
        .select("*, topics(name)")
        .order("created_at", { ascending: true })) as {
    data: SourceRow[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).map((row) => mapSourceRow(row)).slice(0, limit);
}

async function listAllDebugFeedItems(
  supabase: SupabaseClient,
  apiKeyHash: string | undefined,
): Promise<FeedItemWithMeta[]> {
  const [{ data, error }, reactionsByFeedItem] = await Promise.all([
    (apiKeyHash
      ? await supabase.rpc("debug_get_feed_items", { p_api_key_hash: apiKeyHash })
      : await supabase
          .from("feed_items")
          .select("*, topics(name), sources(source_score)")
          .order("published_at", { ascending: false, nullsFirst: false })) as {
      data: FeedItemRow[] | null;
      error: { message: string } | null;
    },
    loadReactionsByFeedItem(supabase, apiKeyHash),
  ]);

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapFeedItemRow(row, reactionsByFeedItem[row.id] ?? []),
  );
}

export async function listDebugFeedItems(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<FeedItemWithMeta[]> {
  const items = await listAllDebugFeedItems(supabase, apiKeyHash);
  return items
    .filter((item) => !item.reactionTypes.includes("hide"))
    .slice(0, limit);
}

export async function listDebugSavedItems(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<FeedItemWithMeta[]> {
  const items = await listAllDebugFeedItems(supabase, apiKeyHash);
  return items
    .filter(
      (item) =>
        item.reactionTypes.includes("save") &&
        !item.reactionTypes.includes("hide"),
    )
    .slice(0, limit);
}

export interface DebugResearchResult {
  id: string;
  topic_id: string;
  query: string;
  provider: string;
  result_type: string;
  title: string;
  url: string;
  snippet: string | null;
  source_name: string | null;
  source_domain: string | null;
  author_name: string | null;
  published_at: string | null;
  discovered_at: string;
  ranking_position: number | null;
  popularity_score: number | null;
  credibility_score: number | null;
  relevance_score: number | null;
  freshness_score: number | null;
  image_url: string | null;
  channel: string | null;
  research_plan_id: string | null;
  is_follow_up: boolean;
  follow_up_reason: string | null;
  fetched_page_title: string | null;
  fetched_page_description: string | null;
  fetched_image_url: string | null;
  fetch_status: string | null;
  created_at: string;
  updated_at: string;
  genre_id: string | null;
  information_types: unknown;
  cross_genre_tags: unknown;
  risk_level: string | null;
  source_tier: number | null;
  requires_verification: boolean | null;
  verification_issues: unknown;
  temporal_status: string | null;
}

const DEBUG_RESEARCH_RESULT_COLUMNS =
  "id, topic_id, query, provider, result_type, title, url, snippet, source_name, source_domain, author_name, published_at, discovered_at, ranking_position, popularity_score, credibility_score, relevance_score, freshness_score, image_url, channel, research_plan_id, is_follow_up, follow_up_reason, fetched_page_title, fetched_page_description, fetched_image_url, fetch_status, created_at, updated_at, genre_id, information_types, cross_genre_tags, risk_level, source_tier, requires_verification, verification_issues, temporal_status";

export async function listDebugResearchResults(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugResearchResult[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_research_results", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("research_results")
        .select(DEBUG_RESEARCH_RESULT_COLUMNS)
        .order("discovered_at", { ascending: false })) as {
    data: DebugResearchResult[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}

export interface DebugRecommendationCard {
  id: string;
  topic_id: string;
  information_type: string;
  generated_title: string;
  generated_summary: string;
  display_reason: string;
  image_url: string | null;
  source_feed_item_ids: string[] | null;
  source_research_result_ids: string[] | null;
  source_urls: string[] | null;
  source_names: string[] | null;
  click_score: number;
  created_at: string;
  updated_at: string;
  genre_id: string | null;
  information_types: unknown;
  cross_genre_tags: unknown;
  risk_level: string | null;
  freshness_level: string | null;
  warnings: unknown;
  information_value_score: number | null;
  score_breakdown: unknown;
  dedupe_key: string | null;
  entity_name: string | null;
}

const DEBUG_RECOMMENDATION_CARD_COLUMNS =
  "id, topic_id, information_type, generated_title, generated_summary, display_reason, image_url, source_feed_item_ids, source_research_result_ids, source_urls, source_names, click_score, created_at, updated_at, genre_id, information_types, cross_genre_tags, risk_level, freshness_level, warnings, information_value_score, score_breakdown, dedupe_key, entity_name";

export async function listDebugRecommendationCards(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugRecommendationCard[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_recommendation_cards", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("recommendation_cards")
        .select(DEBUG_RECOMMENDATION_CARD_COLUMNS)
        .order("created_at", { ascending: false })) as {
    data: DebugRecommendationCard[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}

export async function listDebugTopicClassifications(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugTopicClassification[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_topic_classifications", {
        p_api_key_hash: apiKeyHash,
      })
    : await supabase
        .from("topic_classifications")
        .select(
          "topic_id, topic_name, entity_type, parent_category, sub_category, detail_category, summary, intent_tags, recommended_source_types, search_keywords, confidence, needs_user_confirmation, ambiguity_reason, candidate_entities, research_hints, notes, identification_status, canonical_url, official_url, youtube_channel_url, freshness_profile, freshness_reason, min_refresh_interval_minutes, default_card_ttl_hours, time_intent, time_intent_reason, normalized_topic, entity_name, understanding_entity_type, intent_category, information_needs, priority_signals, negative_signals, search_hints, source_hints, audience_level, location_required, location_text, ambiguity_is_ambiguous, understanding_ambiguity_reason, candidate_meanings, user_intent_summary, topic_kind, primary_genre_id, secondary_genre_ids, auxiliary_genre_ids, information_types, cross_genre_tags, applied_cross_genre_rule_ids",
        )) as { data: TopicClassificationRow[] | null; error: { message: string } | null };

  if (error) throw error;

  return (data ?? [])
    .map((row) => ({
      topicId: row.topic_id,
      ...mapTopicClassificationRow(row),
    }))
    .slice(0, limit);
}

export interface DebugResearchPlan {
  id: string;
  topic_id: string;
  topic_name: string;
  primary_goal: string | null;
  preferred_channels: unknown;
  search_queries: unknown;
  official_site_queries: unknown;
  event_queries: unknown;
  exclusion_queries: unknown;
  must_include_signals: unknown;
  must_exclude_signals: unknown;
  source_priority: unknown;
  freshness_policy: unknown;
  expected_result_types: unknown;
  notes_for_vetting: string | null;
  created_at: string;
  primary_genre_id: string | null;
}

// raw_planはdebug用途でも意図的に返さない（AIの生応答に近い内容であり、
// 個別カラムで十分に確認できるため。他のdebug_get_*関数の
// 「raw_resultは含めない」方針と合わせている）。
const DEBUG_RESEARCH_PLAN_COLUMNS =
  "id, topic_id, topic_name, primary_goal, preferred_channels, search_queries, official_site_queries, event_queries, exclusion_queries, must_include_signals, must_exclude_signals, source_priority, freshness_policy, expected_result_types, notes_for_vetting, created_at, primary_genre_id";

export async function listDebugResearchPlans(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugResearchPlan[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_research_plans", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("research_plans")
        .select(DEBUG_RESEARCH_PLAN_COLUMNS)
        .order("created_at", { ascending: false })) as {
    data: DebugResearchPlan[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}

export interface DebugResearchVettingResult {
  id: string;
  topic_id: string;
  research_plan_id: string | null;
  cluster_key: string;
  judgement: string;
  exclude_reason: string | null;
  reason: string | null;
  matched_positive_signals: unknown;
  matched_negative_signals: unknown;
  representative_title: string | null;
  representative_url: string | null;
  candidate_count: number;
  created_at: string;
}

const DEBUG_RESEARCH_VETTING_RESULT_COLUMNS =
  "id, topic_id, research_plan_id, cluster_key, judgement, exclude_reason, reason, matched_positive_signals, matched_negative_signals, representative_title, representative_url, candidate_count, created_at";

export async function listDebugResearchVettingResults(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugResearchVettingResult[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_research_vetting_results", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("research_vetting_results")
        .select(DEBUG_RESEARCH_VETTING_RESULT_COLUMNS)
        .order("created_at", { ascending: false })) as {
    data: DebugResearchVettingResult[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}

// user_idは意図的に含めない（既存のdebug_get_reactions等と同じ方針）。
export interface DebugRecommendationCardReaction {
  id: string;
  recommendation_card_id: string;
  topic_id: string | null;
  reaction_type: string;
  created_at: string;
  updated_at: string;
}

const DEBUG_RECOMMENDATION_CARD_REACTION_COLUMNS =
  "id, recommendation_card_id, topic_id, reaction_type, created_at, updated_at";

export async function listDebugRecommendationCardReactions(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugRecommendationCardReaction[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_recommendation_card_reactions", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("recommendation_card_reactions")
        .select(DEBUG_RECOMMENDATION_CARD_REACTION_COLUMNS)
        .order("created_at", { ascending: false })) as {
    data: DebugRecommendationCardReaction[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}

export interface DebugSourceDomainPreference {
  id: string;
  topic_id: string;
  source_domain: string;
  source_name: string | null;
  positive_score: number;
  negative_score: number;
  like_count: number;
  bad_count: number;
  hide_count: number;
  save_count: number;
  click_count: number;
  last_reaction_at: string | null;
  created_at: string;
  updated_at: string;
}

const DEBUG_SOURCE_DOMAIN_PREFERENCE_COLUMNS =
  "id, topic_id, source_domain, source_name, positive_score, negative_score, like_count, bad_count, hide_count, save_count, click_count, last_reaction_at, created_at, updated_at";

export async function listDebugSourceDomainPreferences(
  supabase: SupabaseClient,
  limit: number,
  apiKeyHash?: string,
): Promise<DebugSourceDomainPreference[]> {
  const { data, error } = (apiKeyHash
    ? await supabase.rpc("debug_get_source_domain_preferences", { p_api_key_hash: apiKeyHash })
    : await supabase
        .from("source_domain_preferences")
        .select(DEBUG_SOURCE_DOMAIN_PREFERENCE_COLUMNS)
        .order("updated_at", { ascending: false })) as {
    data: DebugSourceDomainPreference[] | null;
    error: { message: string } | null;
  };

  if (error) throw error;
  return (data ?? []).slice(0, limit);
}
