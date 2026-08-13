import type {
  NewResearchResult,
  ResearchProvider,
  ResearchQuery,
} from "../types";

// 検索APIキーが未設定の場合に使う開発用のダミーProvider。
// 外部通信を一切行わず、明示的に「モック」と分かる内容だけを返す
// （lib/mock/generateDummyCandidates.tsの命名規約に合わせている）。
// credibilityScoreを常に0にしているのは、呼び出し側（自動収集パイプライン）が
// 「providerがmockの結果はrecommendation_cards生成に使わない」判断をしやすくするため。
export class MockResearchProvider implements ResearchProvider {
  readonly name = "mock" as const;

  // モックは常に固定2件を返すため、ResearchProviderインターフェースが持つ
  // 第3引数（resultsLimit）は受け取らない（TypeScript上、実装側は
  // インターフェースより少ない引数で宣言してよい）。
  async search(query: ResearchQuery, topicId: string): Promise<NewResearchResult[]> {
    const slug = encodeURIComponent(query.query.replace(/\s+/g, "-"));

    return [1, 2].map((i) => ({
      topicId,
      query: query.query,
      provider: "mock" as const,
      resultType: query.expectedResultType,
      title: `「${query.query}」の調査結果サンプル${i}（モック・実データではありません）`,
      url: `https://example.com/research/${slug}/${i}`,
      snippet: `検索APIが未設定のため、開発用のモックデータを返しています。実際の検索結果ではありません（クエリの目的: ${query.purpose}）。`,
      sourceName: "モックデータ",
      sourceDomain: "example.com",
      authorName: null,
      publishedAt: null,
      rankingPosition: i,
      popularityScore: null,
      credibilityScore: 0,
      relevanceScore: null,
      freshnessScore: null,
      imageUrl: null,
      rawMetadata: { mock: true },
      channel: null,
      researchPlanId: null,
      isFollowUp: false,
      followUpReason: null,
      fetchedPageTitle: null,
      fetchedPageDescription: null,
      fetchedImageUrl: null,
      fetchStatus: null,
    }));
  }
}
