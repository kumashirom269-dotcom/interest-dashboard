import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applySourceScoreDelta, type ScoreEvent } from "@/lib/source-scores/queries";
import { upsertSourceDomainPreference } from "@/lib/source-domain-preferences/queries";
import type { ReactionType } from "@/types/domain";
import type {
  RecommendationCardReactionType,
  ToggleableRecommendationCardReactionType,
} from "./types";

const EXCLUSIVE_PAIRS: Partial<
  Record<ToggleableRecommendationCardReactionType, ToggleableRecommendationCardReactionType>
> = {
  like: "bad",
  bad: "like",
};

// カードリアクション（like/bad/save/hide）を、既存のsource_score計算
// （lib/source-scores/queries.ts）が理解できるReactionType相当へ写像する。
// 新しいスコア体系を作らず、既存のRSSソース評価の仕組みをそのまま再利用するための対応表。
const CARD_REACTION_TO_SOURCE_SCORE_REACTION: Record<ToggleableRecommendationCardReactionType, ReactionType> = {
  like: "useful",
  bad: "not_relevant",
  save: "save",
  hide: "hide",
};

// カードの元になったfeed_items（RSS由来の記事）を辿り、それぞれのsource_idに対して
// source_scoreを更新する。research_results由来（sourceFeedItemIdsが空）の場合は
// 更新対象のsourceが無いため何もしない。1枚のカードが複数のfeed_itemを束ねている
// 場合、重複するsource_idへの多重加点を避けるため、source_idごとに1回だけ適用する。
async function applyCardReactionSourceScoreDelta(
  supabase: SupabaseClient,
  userId: string,
  sourceFeedItemIds: string[],
  reactionType: ToggleableRecommendationCardReactionType,
  direction: "add" | "remove",
): Promise<void> {
  if (sourceFeedItemIds.length === 0) return;

  const { data: feedItems, error } = await supabase
    .from("feed_items")
    .select("id, source_id")
    .in("id", sourceFeedItemIds)
    .eq("user_id", userId);
  if (error) throw error;

  const bySource = new Map<string, string>(); // source_id -> representative feed_item_id
  for (const item of feedItems ?? []) {
    if (!bySource.has(item.source_id)) bySource.set(item.source_id, item.id);
  }

  const mappedReactionType = CARD_REACTION_TO_SOURCE_SCORE_REACTION[reactionType];
  const events: ScoreEvent[] = [
    {
      reactionType: mappedReactionType,
      direction,
      reason: `recommendation_card_reaction_${direction}: ${reactionType}`,
      reactionId: null,
    },
  ];

  for (const [sourceId, feedItemId] of bySource) {
    await applySourceScoreDelta({ supabase, userId, sourceId, feedItemId, events });
  }
}

// research_results由来カード（source_feed_item_idsが空）の場合、上のapplyCardReactionSourceScoreDelta
// では更新対象のsourceが見つからず、収集経路の大半を占める検索収集カードで個別ソース学習が
// 一切働かない状態だった（実機検証で判明）。source_research_result_ids→research_results.source_domainを
// 解決し、以下の2系統を更新する。
// 1. sources_domain_preferences（新設）: sourcesの完全一致有無によらず、常にドメイン単位で
//    集計する（レビュー指摘#4）。like/bad/save/hide/clickすべてに対応する。
// 2. 既存sources.source_score: 同一ユーザー・同一トピックの既存sourcesレコードでURLの
//    ホスト名が完全一致するものがあれば、従来通りそちらも更新する（一致しない場合は
//    このsource_score更新のみスキップし、1のドメイン学習は必ず行う）。
// なお、ジャンル・情報タイプ・sourceName単位の学習（Research Plan・情報価値スコアへの反映）は
// 起源によらずlib/reactions/loadReactionSignalSummary.tsが既に反映している。
async function applyResearchResultSourceScoreDelta(
  supabase: SupabaseClient,
  userId: string,
  topicId: string,
  sourceResearchResultIds: string[],
  reactionType: RecommendationCardReactionType,
  direction: "add" | "remove",
): Promise<void> {
  if (sourceResearchResultIds.length === 0) return;

  const { data: researchResults, error: researchResultsError } = await supabase
    .from("research_results")
    .select("id, source_domain, source_name")
    .in("id", sourceResearchResultIds)
    .eq("user_id", userId);
  if (researchResultsError) throw researchResultsError;

  const domainToName = new Map<string, string | null>();
  for (const r of researchResults ?? []) {
    const domain = (r.source_domain as string | null)?.toLowerCase();
    if (!domain) continue;
    if (!domainToName.has(domain)) domainToName.set(domain, (r.source_name as string | null) ?? null);
  }
  if (domainToName.size === 0) return;

  for (const [domain, sourceName] of domainToName) {
    await upsertSourceDomainPreference(supabase, userId, topicId, domain, sourceName, reactionType, direction);
  }

  if (reactionType === "click") return; // click相当のsources.source_score加点は従来通り無し

  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("id, url")
    .eq("user_id", userId)
    .eq("topic_id", topicId);
  if (sourcesError) throw sourcesError;

  const domains = new Set(domainToName.keys());
  const matchedSourceIds = new Set<string>();
  for (const source of sources ?? []) {
    let hostname: string | null = null;
    try {
      hostname = new URL(source.url as string).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (hostname && domains.has(hostname)) matchedSourceIds.add(source.id as string);
  }
  if (matchedSourceIds.size === 0) return;

  const mappedReactionType = CARD_REACTION_TO_SOURCE_SCORE_REACTION[reactionType as ToggleableRecommendationCardReactionType];
  const events: ScoreEvent[] = [
    {
      reactionType: mappedReactionType,
      direction,
      reason: `recommendation_card_reaction_${direction}: ${reactionType} (research_result)`,
      reactionId: null,
    },
  ];

  for (const sourceId of matchedSourceIds) {
    await applySourceScoreDelta({ supabase, userId, sourceId, feedItemId: null, events });
  }
}

export type RecommendationCardReactionsByCard = Record<
  string,
  RecommendationCardReactionType[]
>;

export async function getRecommendationCardReactionsForUser(): Promise<RecommendationCardReactionsByCard> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("recommendation_card_reactions")
    .select("recommendation_card_id, reaction_type")
    .eq("user_id", user.id);

  if (error) throw error;

  const map: RecommendationCardReactionsByCard = {};
  for (const row of data ?? []) {
    const list = map[row.recommendation_card_id] ?? [];
    list.push(row.reaction_type as RecommendationCardReactionType);
    map[row.recommendation_card_id] = list;
  }
  return map;
}

// like/bad/save/hideのトグル処理。処理の流れはlib/reactions/queries.tsの
// toggleReactionForUserと同じパターン（同じreaction_typeが既にあれば削除、
// なければ排他リアクションを先に削除してから追加）。
// カードが呼び出しユーザー自身のものであることを.eq("user_id", userId)で確認し、
// 他ユーザーのカードを指定された場合は.single()がエラーを投げて拒否する。
export async function toggleRecommendationCardReaction(
  recommendationCardId: string,
  reactionType: ToggleableRecommendationCardReactionType,
): Promise<RecommendationCardReactionType[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;

  const { data: card, error: cardError } = await supabase
    .from("recommendation_cards")
    .select("id, topic_id, source_feed_item_ids, source_research_result_ids")
    .eq("id", recommendationCardId)
    .eq("user_id", userId)
    .single();
  if (cardError) throw cardError;

  const sourceFeedItemIds: string[] = card.source_feed_item_ids ?? [];
  const sourceResearchResultIds: string[] = card.source_research_result_ids ?? [];

  const { data: existing, error: existingError } = await supabase
    .from("recommendation_card_reactions")
    .select("id")
    .eq("user_id", userId)
    .eq("recommendation_card_id", recommendationCardId)
    .eq("reaction_type", reactionType)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const { error: deleteError } = await supabase
      .from("recommendation_card_reactions")
      .delete()
      .eq("id", existing.id);
    if (deleteError) throw deleteError;

    await applyCardReactionSourceScoreDelta(supabase, userId, sourceFeedItemIds, reactionType, "remove");
    await applyResearchResultSourceScoreDelta(
      supabase,
      userId,
      card.topic_id,
      sourceResearchResultIds,
      reactionType,
      "remove",
    );
  } else {
    const opposite = EXCLUSIVE_PAIRS[reactionType];
    if (opposite) {
      const { data: deletedOpposite, error: deleteOppositeError } = await supabase
        .from("recommendation_card_reactions")
        .delete()
        .eq("user_id", userId)
        .eq("recommendation_card_id", recommendationCardId)
        .eq("reaction_type", opposite)
        .select("id");
      if (deleteOppositeError) throw deleteOppositeError;

      if (deletedOpposite && deletedOpposite.length > 0) {
        await applyCardReactionSourceScoreDelta(supabase, userId, sourceFeedItemIds, opposite, "remove");
        await applyResearchResultSourceScoreDelta(
          supabase,
          userId,
          card.topic_id,
          sourceResearchResultIds,
          opposite,
          "remove",
        );
      }
    }

    const { error: insertError } = await supabase
      .from("recommendation_card_reactions")
      .insert({
        user_id: userId,
        recommendation_card_id: recommendationCardId,
        topic_id: card.topic_id,
        reaction_type: reactionType,
      });
    if (insertError) throw insertError;

    await applyCardReactionSourceScoreDelta(supabase, userId, sourceFeedItemIds, reactionType, "add");
    await applyResearchResultSourceScoreDelta(
      supabase,
      userId,
      card.topic_id,
      sourceResearchResultIds,
      reactionType,
      "add",
    );
  }

  const { data: current, error: currentError } = await supabase
    .from("recommendation_card_reactions")
    .select("reaction_type")
    .eq("user_id", userId)
    .eq("recommendation_card_id", recommendationCardId);
  if (currentError) throw currentError;

  return (current ?? []).map((r) => r.reaction_type as RecommendationCardReactionType);
}

// clickはlike/bad/save/hideと違いトグルではない（「解除」という概念がない）。
// unique(user_id, recommendation_card_id, reaction_type)制約があるため、2回目以降の
// クリックはinsertではなくupsert（on conflict do update）でupdated_atだけ更新し、
// 実際の「クリックされた回数」はrecommendation_cards.click_scoreのインクリメントで表現する。
export async function recordRecommendationCardClick(
  recommendationCardId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const userId = user.id;

  const { data: card, error: cardError } = await supabase
    .from("recommendation_cards")
    .select("id, topic_id, click_score, source_research_result_ids")
    .eq("id", recommendationCardId)
    .eq("user_id", userId)
    .single();
  if (cardError) throw cardError;

  const { error: upsertError } = await supabase
    .from("recommendation_card_reactions")
    .upsert(
      {
        user_id: userId,
        recommendation_card_id: recommendationCardId,
        topic_id: card.topic_id,
        reaction_type: "click",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,recommendation_card_id,reaction_type" },
    );
  if (upsertError) throw upsertError;

  const { error: updateScoreError } = await supabase
    .from("recommendation_cards")
    .update({ click_score: (card.click_score ?? 0) + 1 })
    .eq("id", recommendationCardId)
    .eq("user_id", userId);
  if (updateScoreError) throw updateScoreError;

  // クリックはseen相当の弱い肯定シグナルとしてドメイン学習にのみ反映する（レビュー指摘#4）。
  // 既存のsources.source_score・aggregateReactionSignalsへは、既存方針通りclickを
  // プラス/マイナス学習として使わない（クリックはこのドメイン単位学習の対象のみ）。
  const sourceResearchResultIds: string[] = card.source_research_result_ids ?? [];
  await applyResearchResultSourceScoreDelta(supabase, userId, card.topic_id, sourceResearchResultIds, "click", "add");
}
