import { createClient } from "@/lib/supabase/server";
import { normalizePublishedAt } from "./normalizePublishedAt";
import type {
  NewResearchResult,
  ResearchChannel,
  ResearchProviderName,
  ResearchResult,
  ResearchResultType,
} from "./types";
import {
  computeSourceTier,
  containsTier3OnlyProhibitedInformationType,
} from "@/lib/research-review/sourceTier";

export interface GenreEnrichmentContext {
  genreId: string;
  informationTypes: string[];
  crossGenreTags: string[];
  riskLevel: string;
  // トピックの公式URL（topic_classifications.official_url）。sourceTier判定で、
  // 実際のURLがこのドメインと一致するかどうかの根拠に使う。
  officialUrl?: string | null;
  // sources.is_official=trueで既に確認済みのドメイン一覧。同様にsourceTier判定の根拠に使う。
  knownOfficialDomains?: string[];
}

// Provider（WebSearchApiProvider/MockResearchProvider/公式サイトクロール）はトピックの
// classificationを知らないため、収集直後・insertResearchResults呼び出し直前にこの関数で
// ジャンル情報・sourceTier・要検証フラグを付与する。候補精査・クラスタリング・カード生成・
// Debug APIの間でジャンル情報が失われないようにするための一括エンリッチ処理。
//
// sourceTierは、channel（収集意図のラベル）だけでは判定せず、実際のURLを
// isVerifiedOfficialUrlで検証した結果を根拠にする（lib/research-review/sourceTier.ts参照）。
export function enrichResearchResultsWithGenreInfo(
  results: NewResearchResult[],
  context: GenreEnrichmentContext,
): NewResearchResult[] {
  return results.map((r) => {
    const sourceTier = computeSourceTier(r.channel ?? null, false, r.url, {
      topicOfficialUrl: context.officialUrl ?? null,
      knownOfficialDomains: context.knownOfficialDomains ?? [],
      genreId: context.genreId,
      professionalSourceText: `${r.title} ${r.snippet ?? ""} ${r.sourceName ?? ""}`,
    });
    const requiresVerification = sourceTier === 3 && containsTier3OnlyProhibitedInformationType(context.informationTypes);
    return {
      ...r,
      genreId: context.genreId,
      informationTypes: context.informationTypes,
      crossGenreTags: context.crossGenreTags,
      riskLevel: context.riskLevel,
      sourceTier,
      requiresVerification,
      verificationIssues: requiresVerification
        ? ["Tier3（補完プラットフォーム）単独の情報であり、公式・専門情報源での確認が必要です"]
        : [],
      temporalStatus: "unknown",
    };
  });
}

const SELECT_COLUMNS =
  "id, topic_id, query, provider, result_type, title, url, snippet, source_name, source_domain, author_name, published_at, discovered_at, ranking_position, popularity_score, credibility_score, relevance_score, freshness_score, image_url, raw_metadata, channel, research_plan_id, is_follow_up, follow_up_reason, fetched_page_title, fetched_page_description, fetched_image_url, fetch_status, genre_id, information_types, cross_genre_tags, risk_level, source_tier, requires_verification, verification_issues, temporal_status";

interface ResearchResultRow {
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
  raw_metadata: unknown;
  channel: string | null;
  research_plan_id: string | null;
  is_follow_up: boolean;
  follow_up_reason: string | null;
  fetched_page_title: string | null;
  fetched_page_description: string | null;
  fetched_image_url: string | null;
  fetch_status: string | null;
  genre_id: string | null;
  information_types: string[] | null;
  cross_genre_tags: string[] | null;
  risk_level: string | null;
  source_tier: number | null;
  requires_verification: boolean | null;
  verification_issues: string[] | null;
  temporal_status: string | null;
}

function mapRow(row: ResearchResultRow): ResearchResult {
  return {
    id: row.id,
    topicId: row.topic_id,
    query: row.query,
    provider: row.provider as ResearchProviderName,
    resultType: row.result_type as ResearchResultType,
    title: row.title,
    url: row.url,
    snippet: row.snippet,
    sourceName: row.source_name,
    sourceDomain: row.source_domain,
    authorName: row.author_name,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    rankingPosition: row.ranking_position,
    popularityScore: row.popularity_score,
    credibilityScore: row.credibility_score,
    relevanceScore: row.relevance_score,
    freshnessScore: row.freshness_score,
    imageUrl: row.image_url,
    rawMetadata: row.raw_metadata,
    channel: row.channel as ResearchChannel | null,
    researchPlanId: row.research_plan_id,
    isFollowUp: row.is_follow_up,
    followUpReason: row.follow_up_reason,
    fetchedPageTitle: row.fetched_page_title,
    fetchedPageDescription: row.fetched_page_description,
    fetchedImageUrl: row.fetched_image_url,
    fetchStatus: row.fetch_status as ResearchResult["fetchStatus"],
    genreId: row.genre_id,
    informationTypes: row.information_types ?? [],
    crossGenreTags: row.cross_genre_tags ?? [],
    riskLevel: row.risk_level,
    sourceTier: (row.source_tier as 1 | 2 | 3 | null) ?? null,
    requiresVerification: row.requires_verification ?? false,
    verificationIssues: row.verification_issues ?? [],
    temporalStatus: (row.temporal_status as ResearchResult["temporalStatus"]) ?? "unknown",
  };
}

// 検索クエリの実行結果をresearch_resultsへ保存する。
// 同一トピック・同一URLは(topic_id, url)のunique制約によりignoreDuplicatesされるため、
// 同じ記事を複数クエリ・複数回の自動収集で見つけても重複保存されない。
//
// 注意: Postgresの1回のINSERT文の中に同じ競合キー（topic_id, url）を持つ行が
// 複数含まれていると、ON CONFLICTがあっても「cannot affect row a second time」で
// 失敗する（ignoreDuplicatesは別バッチ・別呼び出し間の重複には効くが、
// 同一バッチ内の重複には効かない）。複数の検索クエリが同じURLを見つけた場合
// （AIが似たクエリを重複生成した場合等）にこれが起こりうるため、
// DBに渡す前にurlで重複排除しておく。
export async function insertResearchResults(
  topicId: string,
  results: NewResearchResult[],
): Promise<ResearchResult[]> {
  if (results.length === 0) return [];

  const seenUrls = new Set<string>();
  const deduped = results.filter((r) => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("research_results")
    .upsert(
      deduped.map((r) => ({
        user_id: user.id,
        topic_id: topicId,
        query: r.query,
        provider: r.provider,
        result_type: r.resultType,
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source_name: r.sourceName,
        source_domain: r.sourceDomain,
        author_name: r.authorName,
        // Provider側で正規化済みのはずだが、将来別Providerが不正な日付表現を
        // そのまま渡してきてもバッチinsert全体を失敗させないよう、ここでも再検証する。
        published_at: normalizePublishedAt(r.publishedAt),
        ranking_position: r.rankingPosition,
        popularity_score: r.popularityScore,
        credibility_score: r.credibilityScore,
        relevance_score: r.relevanceScore,
        freshness_score: r.freshnessScore,
        image_url: r.imageUrl,
        raw_metadata: r.rawMetadata,
        channel: r.channel,
        research_plan_id: r.researchPlanId,
        is_follow_up: r.isFollowUp,
        follow_up_reason: r.followUpReason,
        fetched_page_title: r.fetchedPageTitle,
        fetched_page_description: r.fetchedPageDescription,
        fetched_image_url: r.fetchedImageUrl,
        fetch_status: r.fetchStatus,
        genre_id: r.genreId ?? null,
        information_types: r.informationTypes ?? [],
        cross_genre_tags: r.crossGenreTags ?? [],
        risk_level: r.riskLevel ?? null,
        source_tier: r.sourceTier ?? null,
        requires_verification: r.requiresVerification ?? false,
        verification_issues: r.verificationIssues ?? [],
        temporal_status: r.temporalStatus ?? "unknown",
      })),
      { onConflict: "topic_id,url", ignoreDuplicates: true },
    )
    .select(SELECT_COLUMNS);

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row as unknown as ResearchResultRow));
}

export async function getResearchResultsForTopic(
  topicId: string,
): Promise<ResearchResult[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("research_results")
    .select(SELECT_COLUMNS)
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .order("discovered_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapRow(row as unknown as ResearchResultRow));
}
