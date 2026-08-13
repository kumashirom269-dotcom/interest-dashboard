import type { FeedItemWithMeta } from "@/lib/feed-items/queries";
import type { ResearchChannel, ResearchResult } from "@/lib/research/types";

// feed_items（RSS由来）とresearch_results（検索由来）の両方をクラスタリング・
// おすすめカード生成の入力にできるようにする共通形状。
// origin/originIdを持たせることで、カード保存時にsource_feed_item_ids /
// source_research_result_idsのどちらに振り分けるかを判定できるようにしている。
export interface ClusterableArticle {
  id: string;
  topicId: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceDomain: string | null;
  rankingPosition: number | null;
  url: string;
  publishedAt: string;
  imageUrl: string | null;
  origin: "feed_item" | "research_result";
  // どの収集チャネルで見つかったか。feed_item由来は常に"rss"扱いにする
  // （API節約モードでの精査対象クラスタの優先度付けに使う。
  // app/(app)/topics/actions.tsのselectClustersForVetting参照）。
  channel: ResearchChannel | null;
  // evaluateResearchCoverageによる不足判断を受けた補助検索（追加検索・探索範囲拡張）で
  // 見つかった結果かどうか。feed_item由来は常にfalse。カード生成時に「最新情報のように
  // 書かない」判断の材料として使う（lib/ai/generateRecommendationCard.ts参照）。
  isFollowUp: boolean;
  // research_resultsに保存済みの三層構造・ジャンル情報（lib/research/queries.tsの
  // enrichResearchResultsWithGenreInfo参照）。feed_item由来は現状これらの列を持たないためnull。
  sourceTier: 1 | 2 | 3 | null;
  informationTypes: string[];
  isOfficialSource: boolean;
}

export function feedItemToClusterableArticle(
  item: FeedItemWithMeta,
): ClusterableArticle {
  return {
    id: item.id,
    topicId: item.topic_id,
    title: item.title,
    summary: item.summary,
    sourceName: item.source_name,
    sourceDomain: null,
    rankingPosition: null,
    url: item.url,
    publishedAt: item.published_at || "",
    imageUrl: item.image_url ?? null,
    origin: "feed_item",
    channel: "rss",
    isFollowUp: false,
    sourceTier: null,
    informationTypes: [],
    isOfficialSource: false,
  };
}

export function researchResultToClusterableArticle(
  result: ResearchResult,
): ClusterableArticle {
  return {
    id: result.id,
    topicId: result.topicId,
    title: result.title,
    // 検索スニペットが無い場合、fetchWebPageSummaryによるページ要約取得結果
    // （fetchedPageDescription）があればフォールバックとして使う。中身の薄さ判定
    // （detectThinOrEmptyResult）やカード生成の材料が空にならないようにするため。
    summary: result.snippet || result.fetchedPageDescription || "",
    sourceName: result.sourceName ?? result.sourceDomain ?? "不明な情報源",
    sourceDomain: result.sourceDomain,
    rankingPosition: result.rankingPosition,
    url: result.url,
    publishedAt: result.publishedAt || result.discoveredAt || "",
    // 検索・公式サイト直接クロールで画像が取れなかった場合、
    // fetchWebPageSummaryによるog:image取得結果があればフォールバックとして使う。
    imageUrl: result.imageUrl ?? result.fetchedImageUrl,
    origin: "research_result",
    channel: result.channel,
    isFollowUp: result.isFollowUp,
    sourceTier: result.sourceTier,
    informationTypes: result.informationTypes,
    // channelの主張ではなく、enrichResearchResultsWithGenreInfoで検証済みのsourceTierを
    // 根拠にする（lib/research-review/sourceTier.ts参照）。
    isOfficialSource: result.sourceTier === 1,
  };
}

// トークン化して単純なJaccard類似度でタイトルの近さを見る、簡易的なヒューリスティック。
// 本格的なエンティティ抽出・意味的クラスタリングではない点に注意（将来の改善ポイント）。
// lib/recommendation-cards/dedupeKey.tsからも再利用するためexportする。
export function normalizeTitleTokens(title: string): Set<string> {
  const normalized = title
    .toLowerCase()
    .replace(/[!-/:-@[-`{-~！-／：-＠［-｀｛-～、。「」『』・\s]+/g, " ");
  return new Set(normalized.split(" ").filter((token) => token.length >= 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x) as string;
    if (p === x) return x;
    const root = this.find(p);
    this.parent.set(x, root);
    return root;
  }

  union(x: string, y: string): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX !== rootY) this.parent.set(rootX, rootY);
  }
}

export interface ClusterOptions {
  titleSimilarityThreshold?: number;
  maxDayGap?: number;
  // TopicUnderstanding.entityName（対象が特定の固有名詞の場合）。指定された場合、
  // 両方のタイトルにこのエンティティ名が含まれる記事ペアは「同一対象について書かれている
  // 可能性が高い」とみなし、類似度しきい値・許容日数を緩めて同一クラスタになりやすくする
  // （33ジャンルエンジンの一環。本格的なエンティティ抽出ではなく、文字列一致による簡易判定）。
  entityName?: string | null;
  // GenreDetailedConfig.normalizationKeysのうち、"_id"を含むキー（event_id等）が
  // 定義されているジャンルは、同一出来事の告知・続報が期間を空けて出ることが多いため、
  // エンティティ一致時の許容日数をより広げる。
  hasEventLikeNormalizationKey?: boolean;
}

function containsEntityName(title: string, entityNameLower: string): boolean {
  return entityNameLower.length > 0 && title.toLowerCase().includes(entityNameLower);
}

// 同じtopic_idかつタイトルが似ている（かつ公開日が近い）記事を1つのクラスタにまとめる。
// クラスタ = 1つのおすすめ情報カードの元になる記事群。
// feed_items・research_resultsを問わず、ClusterableArticleの形に揃えた配列を渡せる。
export function clusterArticlesByTopicAndTitle(
  items: ClusterableArticle[],
  options: ClusterOptions = {},
): ClusterableArticle[][] {
  const threshold = options.titleSimilarityThreshold ?? 0.4;
  const maxDayGapMs = (options.maxDayGap ?? 4) * 24 * 60 * 60 * 1000;
  const entityNameLower = (options.entityName ?? "").toLowerCase().trim();
  // エンティティ一致時の緩和幅。イベント系正規化キーを持つジャンルはより広く許容する。
  const entityMatchThresholdBonus = 0.15;
  const entityMatchDayGapMultiplier = options.hasEventLikeNormalizationKey ? 3 : 1.5;

  const byTopic = new Map<string, ClusterableArticle[]>();
  for (const item of items) {
    const list = byTopic.get(item.topicId) ?? [];
    list.push(item);
    byTopic.set(item.topicId, list);
  }

  const clusters: ClusterableArticle[][] = [];

  for (const topicItems of byTopic.values()) {
    const unionFind = new UnionFind();
    const tokensById = new Map(
      topicItems.map((item) => [item.id, normalizeTitleTokens(item.title)]),
    );

    for (let i = 0; i < topicItems.length; i++) {
      for (let j = i + 1; j < topicItems.length; j++) {
        const itemA = topicItems[i];
        const itemB = topicItems[j];

        const isEntityMatch =
          entityNameLower.length > 0 &&
          containsEntityName(itemA.title, entityNameLower) &&
          containsEntityName(itemB.title, entityNameLower);
        const effectiveMaxDayGapMs = isEntityMatch
          ? maxDayGapMs * entityMatchDayGapMultiplier
          : maxDayGapMs;
        const effectiveThreshold = isEntityMatch
          ? Math.max(0, threshold - entityMatchThresholdBonus)
          : threshold;

        const dayGap = Math.abs(
          new Date(itemA.publishedAt || 0).getTime() -
            new Date(itemB.publishedAt || 0).getTime(),
        );
        if (dayGap > effectiveMaxDayGapMs) continue;

        const similarity = jaccardSimilarity(
          tokensById.get(itemA.id)!,
          tokensById.get(itemB.id)!,
        );
        if (similarity >= effectiveThreshold) {
          unionFind.union(itemA.id, itemB.id);
        }
      }
    }

    const groups = new Map<string, ClusterableArticle[]>();
    for (const item of topicItems) {
      const root = unionFind.find(item.id);
      const group = groups.get(root) ?? [];
      group.push(item);
      groups.set(root, group);
    }
    clusters.push(...groups.values());
  }

  return clusters;
}
