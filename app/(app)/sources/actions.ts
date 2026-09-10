"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapSourceRow, type SourceRow, type SourceWithTopic } from "@/lib/sources/queries";
import { fetchRssFeedItems } from "@/lib/rss/fetchFeedItems";
import { getPreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import {
  detectArticleLanguage,
  matchesPreferredLanguage,
  type PreferredLanguage,
} from "@/lib/language/detectLanguage";
import { isWebDiscoveryEligible } from "@/lib/web-discovery/eligibility";
import { fetchWebPageSummary } from "@/lib/web-discovery/fetchWebPageSummary";
import {
  discoverLinksForUrl,
  type DiscoveredLink,
  type WebDiscoveryResult,
} from "@/lib/web-discovery/discoverLinks";
import type { FetchMethod, SourceStatus, SourceType } from "@/types/domain";
import { DEV_TOOLS_ENABLED } from "@/lib/config/devTools";

async function getAuthedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

export async function updateSourceStatus(
  sourceId: string,
  status: SourceStatus,
): Promise<SourceWithTopic> {
  const { supabase, userId } = await getAuthedUserId();

  const { data, error } = await supabase
    .from("sources")
    .update({ status })
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select("*, topics(name)")
    .single();

  if (error) throw error;

  revalidatePath("/sources");
  revalidatePath("/topics");
  return mapSourceRow(data as unknown as SourceRow);
}

export interface UpdateSourceSettingsInput {
  rssUrl: string;
  fetchMethod: FetchMethod;
  sourceType: SourceType;
  isOfficial: boolean;
  isSpecificSource: boolean;
  isSearchSeed: boolean;
  needsReview: boolean;
  reviewReason: string;
  sourceReliabilityScore: number | null;
  topicRelevanceScore: number | null;
}

// /sources画面からRSS URL・取得方法・情報源の種類・品質フラグを手動編集するためのServer Action。
// rss_urlが入力された場合はfetch_methodを強制的に'rss'にする（rss_urlありなのに
// manual/unsupportedのままという矛盾した状態を防ぐため）。空の場合はユーザーが選んだ
// fetch_methodをそのまま使う。
// rss_url・fetch_methodが実際に変化した場合のみfetch_status/エラー情報をリセットする
// （情報源の種類や品質フラグだけを編集した場合は、直近の取得検証結果を保持する）。
export async function updateSourceSettings(
  sourceId: string,
  input: UpdateSourceSettingsInput,
): Promise<SourceWithTopic> {
  const { supabase, userId } = await getAuthedUserId();

  const { data: current, error: currentError } = await supabase
    .from("sources")
    .select("rss_url, fetch_method")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .single();

  if (currentError) throw currentError;

  const trimmedRssUrl = input.rssUrl.trim();
  const fetchMethod: FetchMethod = trimmedRssUrl ? "rss" : input.fetchMethod;
  const fetchBehaviorChanged =
    (current.rss_url ?? "") !== trimmedRssUrl || current.fetch_method !== fetchMethod;

  const { data, error } = await supabase
    .from("sources")
    .update({
      rss_url: trimmedRssUrl || null,
      fetch_method: fetchMethod,
      source_type: input.sourceType,
      is_official: input.isOfficial,
      is_specific_source: input.isSpecificSource,
      is_search_seed: input.isSearchSeed,
      needs_review: input.needsReview,
      review_reason: input.reviewReason.trim() || null,
      source_reliability_score: input.sourceReliabilityScore,
      topic_relevance_score: input.topicRelevanceScore,
      ...(fetchBehaviorChanged
        ? {
            fetch_status: "unverified",
            last_fetch_error_type: null,
            last_fetch_error_message: null,
            consecutive_fetch_failure_count: 0,
          }
        : {}),
    })
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select("*, topics(name)")
    .single();

  if (error) throw error;

  revalidatePath("/sources");
  revalidatePath("/mypage");
  return mapSourceRow(data as unknown as SourceRow);
}

export async function createSampleSource(
  topicId: string,
): Promise<SourceWithTopic> {
  // 開発用の動作確認専用機能。UIボタンはDEV_TOOLS_ENABLEDで隠しているが、Server Actionは
  // 呼び出し口さえわかれば直接叩けてしまうため、ここでも二重に拒否する
  // （実データに"サンプル収集元"というダミー行を混入させたくないため）。
  if (!DEV_TOOLS_ENABLED) {
    throw new Error("この機能は開発環境専用です。");
  }

  const { supabase, userId } = await getAuthedUserId();

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id, name")
    .eq("id", topicId)
    .eq("user_id", userId)
    .single();

  if (topicError) throw topicError;

  const { data, error } = await supabase
    .from("sources")
    .insert({
      user_id: userId,
      topic_id: topic.id,
      name: `${topic.name}のサンプル収集元（開発用）`,
      url: "https://example.com",
      rss_url: null,
      source_type: "other",
      status: "candidate",
      reason: "開発用に手動追加されたサンプル収集元です。",
      priority: 3,
      source_score: 0,
      created_by_ai: false,
    })
    .select("*, topics(name)")
    .single();

  if (error) throw error;

  revalidatePath("/sources");
  return mapSourceRow(data as unknown as SourceRow);
}

export type SourceFetchStatus = "success" | "failed" | "skipped";

export type SourceFetchErrorType =
  | "missing_rss_url"
  | "fetch_failed"
  | "http_error"
  | "parse_failed"
  | "no_items"
  | "all_skipped_by_language"
  | "no_new_items"
  | "unknown";

export interface SourceFetchResult {
  sourceId: string;
  sourceName: string;
  rssUrl: string | null;
  status: SourceFetchStatus;
  fetchedItemCount: number;
  savedItemCount: number;
  skippedByLanguageCount: number;
  skippedAsDuplicateCount: number;
  errorType?: SourceFetchErrorType;
  errorMessage?: string;
}

export interface FetchRssResult {
  sourcesChecked: number;
  itemsFetched: number;
  itemsSkippedByLanguage: number;
  results: SourceFetchResult[];
}

// rss-parserが投げるエラーメッセージから、開発中に原因を切り分けやすいよう分類する。
// rss-parserはHTTPステータスが2xx以外の場合「Status code NNN」という文言のエラーを投げる
// （XMLパース前に検知されるため、これはfetch自体の失敗であってXML解析エラーではない）。
function categorizeFetchError(error: unknown): {
  errorType: SourceFetchErrorType;
  errorMessage: string;
} {
  const message =
    error instanceof Error ? error.message : "RSSの取得に失敗しました";

  const statusMatch = message.match(/Status code (\d+)/i);
  if (statusMatch) {
    return { errorType: "http_error", errorMessage: `HTTP ${statusMatch[1]} エラー` };
  }

  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|timeout|network/i.test(message)) {
    return { errorType: "fetch_failed", errorMessage: message };
  }

  if (/xml|tag|non-whitespace|parse/i.test(message)) {
    return { errorType: "parse_failed", errorMessage: message };
  }

  return { errorType: "unknown", errorMessage: message };
}

// fetch_status/last_fetch_*系カラムに、今回の試行結果を永続化する。
// last_checked_atは既存の挙動（成功時のみ更新）を変えずそのまま維持する。
//
// consecutive_fetch_failure_countは、1回の不調と慢性的な取得失敗をUI側で
// 区別するためのカウンタ（レビュー指摘: 何度失敗しても同じ警告文言しか
// 出せず、ユーザーがどう対処すべきか判断しづらかった）。成功時は0に
// リセットし、失敗時は現在値を読んでから+1する（supabase-jsの.update()は
// "column = column + 1"のような式更新に対応していないため、読んでから
// 書く方式を取る。取得失敗時のみの処理なのでホットパスではない）。
async function persistFetchDiagnostics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourceId: string,
  outcome:
    | { kind: "success" }
    | { kind: "failed"; errorType: SourceFetchErrorType; errorMessage: string },
) {
  const now = new Date().toISOString();

  if (outcome.kind === "success") {
    await supabase
      .from("sources")
      .update({
        last_checked_at: now,
        fetch_status: "verified",
        last_fetch_attempt_at: now,
        last_successful_fetch_at: now,
        last_fetch_error_type: null,
        last_fetch_error_message: null,
        consecutive_fetch_failure_count: 0,
      })
      .eq("id", sourceId);
    return;
  }

  const { data: currentSource } = await supabase
    .from("sources")
    .select("consecutive_fetch_failure_count")
    .eq("id", sourceId)
    .single();
  const nextFailureCount =
    (currentSource?.consecutive_fetch_failure_count ?? 0) + 1;

  await supabase
    .from("sources")
    .update({
      fetch_status: "broken",
      last_fetch_attempt_at: now,
      last_fetch_error_type: outcome.errorType,
      last_fetch_error_message: outcome.errorMessage,
      consecutive_fetch_failure_count: nextFailureCount,
    })
    .eq("id", sourceId);
}

// 1回のRSS取得あたり、ページog:image補完を試みる最大件数（レイテンシ上限のため）。
const RSS_OG_IMAGE_FETCH_LIMIT = 12;

export interface FetchableSource {
  id: string;
  topic_id: string;
  name: string;
  rss_url: string;
}

// source 1件分のRSS取得・feed_items保存・診断情報の永続化を行う。
// fetchActiveSourcesRss（/sources画面の開発用ボタン）と、トピック登録直後の
// 自動収集パイプライン（lib/topics/autoCollect.ts）の両方から共通で呼び出す。
export async function fetchAndSaveRssForSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  source: FetchableSource,
  preferredLanguage: PreferredLanguage,
): Promise<SourceFetchResult> {
  try {
    const fetchedItems = await fetchRssFeedItems(source.rss_url);

    if (fetchedItems.length === 0) {
      await persistFetchDiagnostics(supabase, source.id, { kind: "success" });
      return {
        sourceId: source.id,
        sourceName: source.name,
        rssUrl: source.rss_url,
        status: "success",
        fetchedItemCount: 0,
        savedItemCount: 0,
        skippedByLanguageCount: 0,
        skippedAsDuplicateCount: 0,
        errorType: "no_items",
        errorMessage: "フィードに記事が含まれていませんでした",
      };
    }

    // 取得言語設定に一致する記事だけをfeed_itemsに保存する
    const items = fetchedItems.filter((item) => {
      const text = [item.title, item.summary, item.raw_excerpt].join(" ");
      return matchesPreferredLanguage(
        detectArticleLanguage(text),
        preferredLanguage,
      );
    });
    const skippedByLanguageCount = fetchedItems.length - items.length;

    if (items.length === 0) {
      await persistFetchDiagnostics(supabase, source.id, { kind: "success" });
      return {
        sourceId: source.id,
        sourceName: source.name,
        rssUrl: source.rss_url,
        status: "success",
        fetchedItemCount: fetchedItems.length,
        savedItemCount: 0,
        skippedByLanguageCount,
        skippedAsDuplicateCount: 0,
        errorType: "all_skipped_by_language",
        errorMessage: "言語設定によりすべての記事がスキップされました",
      };
    }

    // RSSの<enclosure>に画像が無い記事は、元記事ページのog:imageをベストエフォートで
    // 補完する（レビュー指摘: 「画像なし」の頻発対応）。以前はこの補完を設定画面の
    // 開発用AI最適化ボタンからの手動実行時にしか行っておらず、通常の自動収集では
    // 一度もOGP画像を探しに行っていなかった。AI APIは使わない単純なHTTP取得のため、
    // 課金は発生しない（AIタイトル・要約の生成とは別物）。
    // 1回のRSS取得あたりの対象件数は、収集全体のレイテンシに悪影響が出ないよう
    // 上限を設け、並列取得する（1件あたり最大6秒のタイムアウト、失敗しても無視）。
    const itemsMissingImage = items.filter((item) => !item.image_url);
    const targetsForOgImage = itemsMissingImage.slice(0, RSS_OG_IMAGE_FETCH_LIMIT);
    if (targetsForOgImage.length > 0) {
      const results = await Promise.allSettled(
        targetsForOgImage.map((item) => fetchWebPageSummary(item.url)),
      );
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value.imageUrl) {
          targetsForOgImage[index].image_url = result.value.imageUrl;
        }
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("feed_items")
      .upsert(
        items.map((item) => ({
          user_id: userId,
          topic_id: source.topic_id,
          source_id: source.id,
          title: item.title,
          url: item.url,
          source_name: source.name,
          published_at: item.published_at,
          raw_excerpt: item.raw_excerpt,
          summary: item.summary,
          image_url: item.image_url,
        })),
        { onConflict: "user_id,url", ignoreDuplicates: true },
      )
      .select("id");

    if (insertError) throw insertError;

    const savedItemCount = inserted?.length ?? 0;
    const skippedAsDuplicateCount = items.length - savedItemCount;

    await persistFetchDiagnostics(supabase, source.id, { kind: "success" });

    return {
      sourceId: source.id,
      sourceName: source.name,
      rssUrl: source.rss_url,
      status: "success",
      fetchedItemCount: fetchedItems.length,
      savedItemCount,
      skippedByLanguageCount,
      skippedAsDuplicateCount,
      ...(savedItemCount === 0
        ? {
            errorType: "no_new_items" as const,
            errorMessage: "新規記事はありませんでした（重複のためスキップ）",
          }
        : {}),
    };
  } catch (e) {
    const { errorType, errorMessage } = categorizeFetchError(e);
    await persistFetchDiagnostics(supabase, source.id, {
      kind: "failed",
      errorType,
      errorMessage,
    });
    return {
      sourceId: source.id,
      sourceName: source.name,
      rssUrl: source.rss_url,
      status: "failed",
      fetchedItemCount: 0,
      savedItemCount: 0,
      skippedByLanguageCount: 0,
      skippedAsDuplicateCount: 0,
      errorType,
      errorMessage,
    };
  }
}

export async function fetchActiveSourcesRss(): Promise<FetchRssResult> {
  // 開発用の動作確認専用機能（全active収集元を対象にした一括RSS再取得）。
  // UIボタンはDEV_TOOLS_ENABLEDで隠しているが、Server Actionは呼び出し口さえわかれば
  // 直接叩けてしまうため、ここでも二重に拒否する。
  if (!DEV_TOOLS_ENABLED) {
    throw new Error("この機能は開発環境専用です。");
  }

  const { supabase, userId } = await getAuthedUserId();
  const preferredLanguage = await getPreferredFeedLanguageForUser();

  // rss_urlが未設定のsourceも「スキップ」として結果に含めるため、activeなsourceを全件取得する
  const { data: activeSources, error: sourcesError } = await supabase
    .from("sources")
    .select("id, topic_id, name, rss_url")
    .eq("user_id", userId)
    .eq("status", "active");

  if (sourcesError) throw sourcesError;

  const results: SourceFetchResult[] = [];

  for (const source of activeSources ?? []) {
    if (!source.rss_url) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        rssUrl: null,
        status: "skipped",
        fetchedItemCount: 0,
        savedItemCount: 0,
        skippedByLanguageCount: 0,
        skippedAsDuplicateCount: 0,
        errorType: "missing_rss_url",
        errorMessage: "RSS URLが未設定です",
      });
      continue;
    }

    const result = await fetchAndSaveRssForSource(
      supabase,
      userId,
      source as FetchableSource,
      preferredLanguage,
    );
    results.push(result);
  }

  const result: FetchRssResult = {
    sourcesChecked: results.length,
    itemsFetched: results.reduce((sum, r) => sum + r.savedItemCount, 0),
    itemsSkippedByLanguage: results.reduce(
      (sum, r) => sum + r.skippedByLanguageCount,
      0,
    ),
    results,
  };

  revalidatePath("/sources");
  revalidatePath("/mypage");
  return result;
}

// RSSがない公式サイト等について、source.urlのHTMLを取得しnews/live/schedule等の
// キーワードを含む新着情報ページ候補を抽出する（開発用の探索機能）。
// feed_itemsへの保存は行わない。AI API・外部有料APIは一切使用しない。
// 1回の呼び出しにつきsource 1件のみを対象とする（クリックのたびに1件ずつ探索する設計）。
export async function discoverSourceLinks(
  sourceId: string,
): Promise<WebDiscoveryResult> {
  const { supabase, userId } = await getAuthedUserId();

  const { data: source, error } = await supabase
    .from("sources")
    .select("id, name, url, source_type, fetch_method")
    .eq("id", sourceId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  if (!isWebDiscoveryEligible(source)) {
    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceUrl: source.url,
      status: "skipped",
      discoveredLinks: [],
      errorType: "skipped_ineligible",
      errorMessage:
        "このsourceはWeb探索の対象外です（SNS・YouTube・開発用サンプル等）",
    };
  }

  return discoverLinksForUrl(source.id, source.name, source.url);
}

export interface SaveDiscoveredLinksResult {
  savedCount: number;
  skippedAsDuplicateCount: number;
  savedSources: SourceWithTopic[];
}

// Web探索で見つかった候補リンクを、新規sourceとして「候補(candidate)」状態で保存する。
// 探索元sourceの topic_id / source_type / is_official を引き継ぎ、
// fetch_methodはweb_page、needs_reviewは常にtrueにする（自動検出のため要確認）。
// 既に同じURLのsourceが存在する場合は重複登録しない。activeへの昇格は行わない
// （/sources画面でユーザーが内容を確認したうえで手動でstatusを変更する）。
export async function saveDiscoveredLinksAsSources(
  parentSourceId: string,
  links: DiscoveredLink[],
): Promise<SaveDiscoveredLinksResult> {
  const { supabase, userId } = await getAuthedUserId();

  if (links.length === 0) {
    return { savedCount: 0, skippedAsDuplicateCount: 0, savedSources: [] };
  }

  const { data: parent, error: parentError } = await supabase
    .from("sources")
    .select("topic_id, name, source_type, is_official")
    .eq("id", parentSourceId)
    .eq("user_id", userId)
    .single();

  if (parentError) throw parentError;

  const { data: existing, error: existingError } = await supabase
    .from("sources")
    .select("url")
    .eq("user_id", userId)
    .in(
      "url",
      links.map((l) => l.url),
    );

  if (existingError) throw existingError;

  const existingUrls = new Set((existing ?? []).map((s) => s.url));
  const newLinks = links.filter((l) => !existingUrls.has(l.url));

  if (newLinks.length === 0) {
    return { savedCount: 0, skippedAsDuplicateCount: links.length, savedSources: [] };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("sources")
    .insert(
      newLinks.map((link) => ({
        user_id: userId,
        topic_id: parent.topic_id,
        name: link.title,
        url: link.url,
        rss_url: null,
        fetch_method: "web_page" as FetchMethod,
        source_type: parent.source_type,
        status: "candidate" as SourceStatus,
        reason: `Web探索により「${parent.name}」から検出された候補です（一致キーワード: ${link.matchedKeyword}）。`,
        priority: 3,
        source_score: 0,
        created_by_ai: false,
        is_official: parent.is_official ?? false,
        is_specific_source: true,
        is_search_seed: false,
        topic_relevance_score: link.score,
        needs_review: true,
        review_reason:
          "Web探索で自動検出された候補です。内容を確認してから採用してください。",
      })),
    )
    .select("*, topics(name)");

  if (insertError) throw insertError;

  revalidatePath("/sources");

  return {
    savedCount: newLinks.length,
    skippedAsDuplicateCount: links.length - newLinks.length,
    savedSources: (inserted ?? []).map((row) => mapSourceRow(row as unknown as SourceRow)),
  };
}
