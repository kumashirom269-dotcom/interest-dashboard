import {
  listDebugFeedItems,
  listDebugRecommendationCardReactions,
  listDebugRecommendationCards,
  listDebugResearchPlans,
  listDebugResearchResults,
  listDebugResearchVettingResults,
  listDebugSavedItems,
  listDebugSources,
  listDebugTopicClassifications,
  listDebugTopics,
} from "@/lib/debug-api/queries";
import { withDebugAuth } from "@/lib/debug-api/response";
import { isResearchApiKeyConfigured } from "@/lib/research/getResearchProvider";
import { AI_COST_SAVING_MODE, AI_LIMITS } from "@/lib/config/aiLimits";

const SUMMARY_SCAN_LIMIT = 200;
const LATEST_FEED_ITEMS_COUNT = 5;

// 読み取り専用のdebug API。topics/sources/feed_items/topic_classifications/saved_items
// に加え、検索拡張型リサーチ収集（research_results）・おすすめカード（recommendation_cards）の
// 概要と、トピックごとの自動収集サマリを一度にまとめて返す（全体確認用）。
// 件数はSUMMARY_SCAN_LIMIT件までを対象に集計する。
//
// 注意: ここで返せるのは「現時点でDBに保存されている状態」のみ。
// トピック登録時にrunInitialAutoCollectionが生成した検索クエリ件数や、
// ステップごとのwarningsメッセージ自体はDBに永続化していないため、
// 登録直後の画面表示（AutoCollectionResult）以外では過去分を遡って確認できない
// （必要であれば、収集実行ログを別テーブルに残す設計を別途検討する）。
export const GET = withDebugAuth(async (_request, { supabase, apiKeyHash }) => {
  const [
    topics,
    sources,
    feedItems,
    savedItems,
    classifications,
    researchResults,
    recommendationCards,
    researchPlans,
    vettingResults,
    cardReactions,
  ] = await Promise.all([
    listDebugTopics(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugSources(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugFeedItems(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugSavedItems(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugTopicClassifications(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugResearchResults(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugRecommendationCards(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugResearchPlans(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugResearchVettingResults(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
    listDebugRecommendationCardReactions(supabase, SUMMARY_SCAN_LIMIT, apiKeyHash),
  ]);

  const sourcesByStatus: Record<string, number> = {};
  for (const source of sources) {
    sourcesByStatus[source.status] = (sourcesByStatus[source.status] ?? 0) + 1;
  }

  const needsConfirmationCount = classifications.filter(
    (c) => c.needsUserConfirmation,
  ).length;

  const classificationsByTopicKind: Record<string, number> = {};
  const classificationsByGenre: Record<string, number> = {};
  for (const c of classifications) {
    const key = c.understanding.topicKind ?? "unknown";
    classificationsByTopicKind[key] = (classificationsByTopicKind[key] ?? 0) + 1;
    const genreKey = c.understanding.primaryGenreId ?? "unknown";
    classificationsByGenre[genreKey] = (classificationsByGenre[genreKey] ?? 0) + 1;
  }

  const mockResearchResultsCount = researchResults.filter(
    (r) => r.provider === "mock",
  ).length;

  const researchResultsByChannel: Record<string, number> = {};
  const followUpResearchResultsCount = researchResults.filter((r) => r.is_follow_up).length;
  for (const r of researchResults) {
    const key = r.channel ?? "unknown";
    researchResultsByChannel[key] = (researchResultsByChannel[key] ?? 0) + 1;
  }

  const vettingResultsByJudgement: Record<string, number> = {};
  for (const v of vettingResults) {
    vettingResultsByJudgement[v.judgement] = (vettingResultsByJudgement[v.judgement] ?? 0) + 1;
  }

  const vettingResultsByExcludeReason: Record<string, number> = {};
  for (const v of vettingResults) {
    if (!v.exclude_reason) continue;
    vettingResultsByExcludeReason[v.exclude_reason] =
      (vettingResultsByExcludeReason[v.exclude_reason] ?? 0) + 1;
  }

  // reasonは自由文だが、runInitialAutoCollection側で固定の文言を使っているため、
  // 部分一致でJSONパース失敗によるhold・API節約モードによるhold・空リンク除外件数を
  // 大まかに集計できる。
  const holdReasonCounts = {
    parseFailureHoldCount: vettingResults.filter(
      (v) => v.judgement === "hold" && (v.reason ?? "").includes("JSONパース"),
    ).length,
    costSavingHoldCount: vettingResults.filter(
      (v) => v.judgement === "hold" && (v.reason ?? "").includes("API節約モード"),
    ).length,
    thinContentExcludeCount: vettingResults.filter((v) => v.exclude_reason === "thin_content")
      .length,
  };

  const cardReactionsByType: Record<string, number> = {};
  for (const r of cardReactions) {
    cardReactionsByType[r.reaction_type] = (cardReactionsByType[r.reaction_type] ?? 0) + 1;
  }
  const uniqueCardCountWithReaction = (reactionType: string) =>
    new Set(
      cardReactions
        .filter((r) => r.reaction_type === reactionType)
        .map((r) => r.recommendation_card_id),
    ).size;

  const classificationByTopicId = new Map(
    classifications.map((c) => [c.topicId, c]),
  );

  // listDebugResearchPlansはcreated_at降順で返るため、topic_idごとに最初に
  // 出現した行が最新のResearchPlanになる。
  const latestResearchPlanByTopicId = new Map<string, (typeof researchPlans)[number]>();
  for (const plan of researchPlans) {
    if (!latestResearchPlanByTopicId.has(plan.topic_id)) {
      latestResearchPlanByTopicId.set(plan.topic_id, plan);
    }
  }

  const topicsCollectionSummary = topics.map((topic) => {
    const topicFeedItems = feedItems.filter((f) => f.topic_id === topic.id);
    const topicCards = recommendationCards.filter((c) => c.topic_id === topic.id);
    const topicResearchResults = researchResults.filter((r) => r.topic_id === topic.id);
    const topicVettingResults = vettingResults.filter((v) => v.topic_id === topic.id);
    const topicCardReactions = cardReactions.filter((r) => r.topic_id === topic.id);
    const mockCount = topicResearchResults.filter((r) => r.provider === "mock").length;
    const classification = classificationByTopicId.get(topic.id);
    const latestPlan = latestResearchPlanByTopicId.get(topic.id);

    const byChannel: Record<string, number> = {};
    for (const r of topicResearchResults) {
      const key = r.channel ?? "unknown";
      byChannel[key] = (byChannel[key] ?? 0) + 1;
    }

    return {
      topicId: topic.id,
      topicName: topic.name,
      lastCollectedAt: topic.last_collected_at,
      topicKind: classification?.understanding.topicKind ?? null,
      primaryGenreId: classification?.understanding.primaryGenreId ?? null,
      secondaryGenreIds: classification?.understanding.secondaryGenreIds ?? [],
      informationTypes: classification?.understanding.informationTypes ?? [],
      crossGenreTags: classification?.understanding.crossGenreTags ?? [],
      appliedCrossGenreRuleIds: classification?.understanding.appliedCrossGenreRuleIds ?? [],
      freshnessProfile: classification?.freshnessProfile ?? null,
      timeIntent: classification?.timeIntent ?? null,
      userIntentSummary: classification?.understanding.userIntentSummary ?? null,
      feedItemsCount: topicFeedItems.length,
      recommendationCardsCount: topicCards.length,
      researchResultsCount: topicResearchResults.length,
      mockResearchResultsCount: mockCount,
      nonMockResearchResultsCount: topicResearchResults.length - mockCount,
      followUpResearchResultsCount: topicResearchResults.filter((r) => r.is_follow_up).length,
      researchResultsByChannel: byChannel,
      latestResearchPlan: latestPlan
        ? {
            id: latestPlan.id,
            primaryGoal: latestPlan.primary_goal,
            preferredChannels: latestPlan.preferred_channels,
            createdAt: latestPlan.created_at,
            primaryGenreId: latestPlan.primary_genre_id,
          }
        : null,
      vettingResultsCount: topicVettingResults.length,
      vettingExcludedCount: topicVettingResults.filter((v) => v.judgement === "exclude").length,
      cardReactionsCount: topicCardReactions.length,
      likedCardsCount: new Set(
        topicCardReactions.filter((r) => r.reaction_type === "like").map((r) => r.recommendation_card_id),
      ).size,
      hiddenCardsCount: new Set(
        topicCardReactions.filter((r) => r.reaction_type === "hide").map((r) => r.recommendation_card_id),
      ).size,
    };
  });

  return Response.json({
    ok: true,
    resource: "dashboard_summary",
    generatedAt: new Date().toISOString(),
    note: `件数はサーバー側の上限（${SUMMARY_SCAN_LIMIT}件）までを対象に集計しています。収集時のwarningsメッセージ自体はDBへ永続化していないため、ここには含まれません（登録直後の画面表示でのみ確認できます）。ResearchPlan・vetting結果（use/hold/exclude）はresearch_plans/research_vetting_resultsテーブルへ永続化されており、こちらから確認できます。`,
    data: {
      topics: {
        count: topics.length,
        items: topics.map((t) => ({ id: t.id, name: t.name })),
      },
      sources: {
        count: sources.length,
        byStatus: sourcesByStatus,
      },
      feedItems: {
        count: feedItems.length,
        latest: feedItems.slice(0, LATEST_FEED_ITEMS_COUNT).map((item) => ({
          id: item.id,
          title: item.ai_title || item.title,
          sourceName: item.source_name,
          topicName: item.topicName,
          publishedAt: item.published_at,
        })),
      },
      savedItems: {
        count: savedItems.length,
      },
      topicClassifications: {
        count: classifications.length,
        needsConfirmationCount,
        byTopicKind: classificationsByTopicKind,
        byGenre: classificationsByGenre,
        items: classifications.map((c) => ({
          topicId: c.topicId,
          primaryGenreId: c.understanding.primaryGenreId,
          secondaryGenreIds: c.understanding.secondaryGenreIds,
          informationTypes: c.understanding.informationTypes,
          crossGenreTags: c.understanding.crossGenreTags,
          appliedCrossGenreRuleIds: c.understanding.appliedCrossGenreRuleIds,
          topicName: c.topicName,
          entityType: c.entityType,
          confidence: c.confidence,
          needsUserConfirmation: c.needsUserConfirmation,
          freshnessProfile: c.freshnessProfile,
          timeIntent: c.timeIntent,
          // トピック理解（TopicUnderstanding）。「何について」「どんな情報を求めているか」の構造化結果。
          topicKind: c.understanding.topicKind,
          normalizedTopic: c.understanding.normalizedTopic,
          entityName: c.understanding.entityName,
          understandingEntityType: c.understanding.entityType,
          intentCategory: c.understanding.category,
          informationNeeds: c.understanding.informationNeeds,
          prioritySignals: c.understanding.prioritySignals,
          negativeSignals: c.understanding.negativeSignals,
          searchHints: c.understanding.searchHints,
          sourceHints: c.understanding.sourceHints,
          audienceLevel: c.understanding.audienceLevel,
          locationIntent: c.understanding.locationIntent,
          ambiguity: c.understanding.ambiguity,
          userIntentSummary: c.understanding.userIntentSummary,
        })),
      },
      researchResults: {
        count: researchResults.length,
        mockCount: mockResearchResultsCount,
        nonMockCount: researchResults.length - mockResearchResultsCount,
        followUpCount: followUpResearchResultsCount,
        byChannel: researchResultsByChannel,
      },
      recommendationCards: {
        count: recommendationCards.length,
      },
      recommendationCardReactions: {
        count: cardReactions.length,
        byReactionType: cardReactionsByType,
        hiddenCardsCount: uniqueCardCountWithReaction("hide"),
        savedCardsCount: uniqueCardCountWithReaction("save"),
        likedCardsCount: uniqueCardCountWithReaction("like"),
        badCardsCount: uniqueCardCountWithReaction("bad"),
      },
      researchPlans: {
        count: researchPlans.length,
        items: researchPlans.slice(0, LATEST_FEED_ITEMS_COUNT).map((p) => ({
          id: p.id,
          topicId: p.topic_id,
          topicName: p.topic_name,
          primaryGoal: p.primary_goal,
          preferredChannels: p.preferred_channels,
          searchQueries: p.search_queries,
          officialSiteQueries: p.official_site_queries,
          eventQueries: p.event_queries,
          exclusionQueries: p.exclusion_queries,
          mustIncludeSignals: p.must_include_signals,
          mustExcludeSignals: p.must_exclude_signals,
          freshnessPolicy: p.freshness_policy,
          expectedResultTypes: p.expected_result_types,
          notesForVetting: p.notes_for_vetting,
          createdAt: p.created_at,
        })),
      },
      vettingResults: {
        count: vettingResults.length,
        byJudgement: vettingResultsByJudgement,
        byExcludeReason: vettingResultsByExcludeReason,
        ...holdReasonCounts,
        items: vettingResults.slice(0, LATEST_FEED_ITEMS_COUNT).map((v) => ({
          id: v.id,
          topicId: v.topic_id,
          researchPlanId: v.research_plan_id,
          judgement: v.judgement,
          excludeReason: v.exclude_reason,
          reason: v.reason,
          representativeTitle: v.representative_title,
          representativeUrl: v.representative_url,
          candidateCount: v.candidate_count,
        })),
      },
      researchProvider: {
        configured: isResearchApiKeyConfigured(),
        mode: isResearchApiKeyConfigured() ? "real" : "mock",
      },
      // API節約モード（lib/config/aiLimits.ts）の現在の設定値。トピックごとの
      // 実行時統計（vettingバッチ数・失敗数等）はDBへ永続化していないため、
      // ここでは静的な設定値のみを返す（実行時統計は登録直後のAutoCollectionResultで確認）。
      aiConfig: {
        aiCostSavingMode: AI_COST_SAVING_MODE,
        maxResearchResultsPerTopic: AI_LIMITS.maxResearchResultsPerTopic,
        maxClustersForVetting: AI_LIMITS.maxClustersForVetting,
        vettingBatchSize: AI_LIMITS.vettingBatchSize,
        maxCardsPerTopic: AI_LIMITS.maxCardsPerTopic,
        maxBraveQueriesPerTopic: AI_LIMITS.maxBraveQueriesPerTopic,
        maxResultsPerBraveQuery: AI_LIMITS.maxResultsPerBraveQuery,
        maxFollowUpQueries: AI_LIMITS.maxFollowUpQueries,
      },
      topicsCollectionSummary,
    },
  });
});
