import { createClient } from "@/lib/supabase/server";
import { getReactionsByFeedItemForUser } from "@/lib/reactions/queries";
import {
  detectArticleLanguage,
  matchesPreferredLanguage,
  type PreferredLanguage,
} from "@/lib/language/detectLanguage";
import type { FeedItem, ReactionType } from "@/types/domain";

export interface FeedItemWithMeta extends FeedItem {
  topicName: string | null;
  sourceScore: number;
  reactionTypes: ReactionType[];
}

export interface FeedItemRow {
  id: string;
  user_id: string;
  topic_id: string;
  source_id: string;
  title: string;
  url: string;
  source_name: string;
  published_at: string | null;
  raw_excerpt: string | null;
  summary: string | null;
  ai_comment: string | null;
  relevance_score: number;
  is_read: boolean;
  is_saved: boolean;
  image_url: string | null;
  ai_title: string | null;
  ai_summary: string | null;
  ai_processed_at: string | null;
  created_at: string;
  updated_at: string;
  topics: { name: string } | null;
  sources: { source_score: number } | null;
}

export function mapFeedItemRow(
  row: FeedItemRow,
  reactionTypes: ReactionType[],
): FeedItemWithMeta {
  return {
    id: row.id,
    user_id: row.user_id,
    topic_id: row.topic_id,
    source_id: row.source_id,
    title: row.title,
    url: row.url,
    source_name: row.source_name,
    published_at: row.published_at ?? "",
    raw_excerpt: row.raw_excerpt ?? "",
    summary: row.summary ?? "",
    ai_comment: row.ai_comment ?? "",
    related_topics: [],
    relevance_score: row.relevance_score,
    is_read: row.is_read,
    // reactionsテーブルを正とするため、保存状態はreactionTypesから算出する
    is_saved: reactionTypes.includes("save"),
    image_url: row.image_url,
    ai_title: row.ai_title,
    ai_summary: row.ai_summary,
    ai_processed_at: row.ai_processed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    topicName: row.topics?.name ?? null,
    sourceScore: row.sources?.source_score ?? 0,
    reactionTypes,
  };
}

export async function getFeedItemsForUser(): Promise<FeedItemWithMeta[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [{ data, error }, reactionsByFeedItem] = await Promise.all([
    supabase
      .from("feed_items")
      .select("*, topics(name), sources(source_score)")
      .order("published_at", { ascending: false, nullsFirst: false }),
    getReactionsByFeedItemForUser(),
  ]);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const typedRow = row as unknown as FeedItemRow;
    return mapFeedItemRow(typedRow, reactionsByFeedItem[typedRow.id] ?? []);
  });
}

// トピック登録直後の自動収集パイプライン（lib/topics/autoCollect.ts）が、
// そのトピックの記事だけをクラスタリング・カード生成の入力として使うためのスコープ付き取得。
export async function getFeedItemsForTopic(
  topicId: string,
): Promise<FeedItemWithMeta[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [{ data, error }, reactionsByFeedItem] = await Promise.all([
    supabase
      .from("feed_items")
      .select("*, topics(name), sources(source_score)")
      .eq("topic_id", topicId)
      .order("published_at", { ascending: false, nullsFirst: false }),
    getReactionsByFeedItemForUser(),
  ]);

  if (error) throw error;

  return (data ?? []).map((row) => {
    const typedRow = row as unknown as FeedItemRow;
    return mapFeedItemRow(typedRow, reactionsByFeedItem[typedRow.id] ?? []);
  });
}

export function filterVisibleFeedItems(
  items: FeedItemWithMeta[],
): FeedItemWithMeta[] {
  return items.filter((item) => !item.reactionTypes.includes("hide"));
}

export function filterSavedFeedItems(
  items: FeedItemWithMeta[],
): FeedItemWithMeta[] {
  return items.filter(
    (item) =>
      item.reactionTypes.includes("save") &&
      !item.reactionTypes.includes("hide"),
  );
}

// 保存済みの既存記事（DB上にdetected_language列を持たない）を、表示時にヒューリスティックで
// 言語判定してフィルターする。判定がunknownの記事は表示しない。
export function filterByPreferredLanguage(
  items: FeedItemWithMeta[],
  preferred: PreferredLanguage,
): FeedItemWithMeta[] {
  return items.filter((item) => {
    const text = [item.title, item.summary, item.raw_excerpt, item.url].join(
      " ",
    );
    return matchesPreferredLanguage(detectArticleLanguage(text), preferred);
  });
}
