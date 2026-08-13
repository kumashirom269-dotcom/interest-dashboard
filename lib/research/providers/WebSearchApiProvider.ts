import type {
  NewResearchResult,
  ResearchProvider,
  ResearchQuery,
} from "../types";
import { normalizePublishedAt } from "../normalizePublishedAt";

// Brave Search API を使った実装。
// APIキー（BRAVE_SEARCH_API_KEY）が.env.localに設定されている場合のみ生成される
// （lib/research/getResearchProvider.ts参照）。キー未設定時はこのクラス自体が
// インスタンス化されず、MockResearchProviderにフォールバックするため、
// アプリ全体がAPIキー無しでも壊れない。
//
// 実キーでの疎通確認済み。ただし"age"フィールドが"1 day ago"のような相対表現で
// 返ってくることが判明したため、published_atへ保存する前に必ずnormalizePublishedAtで
// 正規化する（変換できない相対表現はnullにし、元の文字列はrawMetadataに残す）。
const BRAVE_SEARCH_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const FETCH_TIMEOUT_MS = 8000;
const RESULTS_PER_QUERY = 5;

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  age?: string;
  meta_url?: { hostname?: string };
  thumbnail?: { src?: string };
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
}

export class WebSearchApiProvider implements ResearchProvider {
  readonly name = "web_search" as const;

  constructor(private readonly apiKey: string) {}

  // 失敗時は空配列で握りつぶさず、理由が分かるErrorをthrowする。
  // 自動収集パイプライン全体を落とさないための吸収は、呼び出し元
  // （runInitialAutoCollection）がクエリ単位でtry/catchしてwarningsに記録する
  // 形で行う（Provider側で結果を握りつぶすと原因が分からなくなるため）。
  async search(
    query: ResearchQuery,
    topicId: string,
    resultsLimit: number = RESULTS_PER_QUERY,
  ): Promise<NewResearchResult[]> {
    const limit = Math.max(1, resultsLimit);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const url = new URL(BRAVE_SEARCH_ENDPOINT);
      url.searchParams.set("q", query.query);
      url.searchParams.set("count", String(limit));

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": this.apiKey,
        },
      });

      if (!res.ok) {
        throw new Error(`Brave Search API request failed: status ${res.status}`);
      }

      let data: BraveSearchResponse;
      try {
        data = (await res.json()) as BraveSearchResponse;
      } catch {
        throw new Error("Brave Search API response shape unexpected（JSON解析に失敗）");
      }

      if (!data || typeof data !== "object" || !("web" in data)) {
        throw new Error("Brave Search API response shape unexpected（web.resultsが見つかりません）");
      }

      const results = data.web?.results ?? [];

      return results.slice(0, limit).map((r, index) => ({
        topicId,
        query: query.query,
        provider: "web_search" as const,
        resultType: query.expectedResultType,
        title: r.title,
        url: r.url,
        snippet: r.description ?? null,
        sourceName: r.meta_url?.hostname ?? null,
        sourceDomain: r.meta_url?.hostname ?? null,
        authorName: null,
        // Brave APIの"age"は"1 day ago"のような相対表現のことがあり、
        // そのままtimestamptz列には入れられないため必ず正規化する。
        // 変換できない場合はnullにし、元の文字列はrawMetadataに残す。
        publishedAt: normalizePublishedAt(r.age),
        rankingPosition: index + 1,
        popularityScore: null,
        credibilityScore: null,
        relevanceScore: null,
        freshnessScore: null,
        imageUrl: r.thumbnail?.src ?? null,
        // channelは呼び出し元（runInitialAutoCollection）が、どの検索クエリ群
        // （officialSiteQueries/eventQueries/searchQueries）から実行されたかに応じて
        // 上書きする。Provider自体はチャネルを意識しない汎用の検索実行役に留める。
        channel: null,
        // 以下も同様に、呼び出し元がResearchPlanの永続化ID・追加検索かどうか・
        // ページ要約取得結果に応じて上書きする。Provider自体はこれらを意識しない。
        researchPlanId: null,
        isFollowUp: false,
        followUpReason: null,
        fetchedPageTitle: null,
        fetchedPageDescription: null,
        fetchedImageUrl: null,
        fetchStatus: null,
        rawMetadata: {
          ...r,
          braveAge: r.age ?? null,
          originalPublishedText: r.age ?? null,
        },
      }));
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("Brave Search API request timed out");
      }
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }
}
