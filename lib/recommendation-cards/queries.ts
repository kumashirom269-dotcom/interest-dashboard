import { createClient } from "@/lib/supabase/server";
import type { ImageSourceType, InformationType, RecommendationCard } from "./types";

interface RecommendationCardRow {
  id: string;
  user_id: string;
  topic_id: string;
  information_type: string;
  generated_title: string;
  generated_summary: string;
  display_reason: string;
  image_url: string | null;
  image_alt: string | null;
  image_source_type: string;
  image_source_url: string | null;
  source_feed_item_ids: string[] | null;
  source_research_result_ids: string[] | null;
  source_urls: string[] | null;
  source_names: string[] | null;
  click_score: number;
  created_at: string;
  updated_at: string;
  topics: { name: string } | null;
  genre_id: string | null;
  information_types: string[] | null;
  cross_genre_tags: string[] | null;
  risk_level: string | null;
  freshness_level: string | null;
  warnings: string[] | null;
  information_value_score: number | null;
  score_breakdown: Record<string, number> | null;
  dedupe_key: string | null;
  entity_name: string | null;
}

function mapRow(row: RecommendationCardRow): RecommendationCard {
  return {
    id: row.id,
    userId: row.user_id,
    topicId: row.topic_id,
    topicName: row.topics?.name ?? null,
    informationType: row.information_type as InformationType,
    generatedTitle: row.generated_title,
    generatedSummary: row.generated_summary,
    displayReason: row.display_reason,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    imageSourceType: row.image_source_type as ImageSourceType,
    imageSourceUrl: row.image_source_url,
    sourceFeedItemIds: row.source_feed_item_ids ?? [],
    sourceResearchResultIds: row.source_research_result_ids ?? [],
    sourceUrls: row.source_urls ?? [],
    sourceNames: row.source_names ?? [],
    clickScore: row.click_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    genreId: row.genre_id,
    informationTypes: row.information_types ?? [],
    crossGenreTags: row.cross_genre_tags ?? [],
    riskLevel: row.risk_level,
    freshnessLevel: row.freshness_level,
    warnings: row.warnings ?? [],
    informationValueScore: row.information_value_score,
    scoreBreakdown: row.score_breakdown,
    dedupeKey: row.dedupe_key,
    entityName: row.entity_name,
  };
}

const SELECT_COLUMNS = "*, topics(name)";

export async function getRecommendationCardsForUser(): Promise<
  RecommendationCard[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("recommendation_cards")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapRow(row as unknown as RecommendationCardRow),
  );
}

export interface NewRecommendationCardInput {
  topicId: string;
  informationType: InformationType;
  generatedTitle: string;
  generatedSummary: string;
  displayReason: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageSourceType: ImageSourceType;
  imageSourceUrl: string | null;
  sourceFeedItemIds: string[];
  sourceResearchResultIds: string[];
  sourceUrls: string[];
  sourceNames: string[];
  genreId?: string | null;
  informationTypes?: string[];
  crossGenreTags?: string[];
  riskLevel?: string | null;
  freshnessLevel?: string | null;
  warnings?: string[];
  informationValueScore?: number | null;
  scoreBreakdown?: Record<string, number> | null;
  dedupeKey?: string | null;
  entityName?: string | null;
}

// hide・click(≈既読/seen)されたカードと同じdedupeKeyを持つ新しいカードの再生成を
// 抑制するために、このトピックで既にhide/clickされているdedupeKeyの集合を取得する。
// 仕様書7-1「hide: 重大な変更があれば再表示可能」に対応するため、呼び出し元
// （app/(app)/topics/actions.ts）でこの集合とlib/recommendation-cards/dedupeKey.tsの
// isMajorUpdateInformationTypeを組み合わせて、重大な更新の場合のみ再表示を許可する。
export async function getSuppressedDedupeKeysForTopic(topicId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: cards, error: cardsError } = await supabase
    .from("recommendation_cards")
    .select("id, dedupe_key")
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .not("dedupe_key", "is", null);
  if (cardsError) throw cardsError;

  const dedupeKeyByCardId = new Map(
    (cards ?? []).map((c) => [c.id as string, c.dedupe_key as string]),
  );
  if (dedupeKeyByCardId.size === 0) return new Set();

  const { data: reactions, error: reactionsError } = await supabase
    .from("recommendation_card_reactions")
    .select("recommendation_card_id, reaction_type")
    .eq("user_id", user.id)
    .in("recommendation_card_id", [...dedupeKeyByCardId.keys()])
    .in("reaction_type", ["hide", "click"]);
  if (reactionsError) throw reactionsError;

  const suppressed = new Set<string>();
  for (const r of reactions ?? []) {
    const key = dedupeKeyByCardId.get(r.recommendation_card_id);
    if (key) suppressed.add(key);
  }
  return suppressed;
}

export async function createRecommendationCards(
  cards: NewRecommendationCardInput[],
): Promise<RecommendationCard[]> {
  if (cards.length === 0) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("recommendation_cards")
    .insert(
      cards.map((card) => ({
        user_id: user.id,
        topic_id: card.topicId,
        information_type: card.informationType,
        generated_title: card.generatedTitle,
        generated_summary: card.generatedSummary,
        display_reason: card.displayReason,
        image_url: card.imageUrl,
        image_alt: card.imageAlt,
        image_source_type: card.imageSourceType,
        image_source_url: card.imageSourceUrl,
        source_feed_item_ids: card.sourceFeedItemIds,
        source_research_result_ids: card.sourceResearchResultIds,
        source_urls: card.sourceUrls,
        source_names: card.sourceNames,
        genre_id: card.genreId ?? null,
        information_types: card.informationTypes ?? [],
        cross_genre_tags: card.crossGenreTags ?? [],
        risk_level: card.riskLevel ?? null,
        freshness_level: card.freshnessLevel ?? null,
        warnings: card.warnings ?? [],
        information_value_score: card.informationValueScore ?? null,
        score_breakdown: card.scoreBreakdown ?? null,
        dedupe_key: card.dedupeKey ?? null,
        entity_name: card.entityName ?? null,
      })),
    )
    .select(SELECT_COLUMNS);

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapRow(row as unknown as RecommendationCardRow),
  );
}
