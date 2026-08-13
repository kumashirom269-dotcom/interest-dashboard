import type { TopicUnderstanding } from "@/lib/topic-classification/types";
import { detectThinOrEmptyResult } from "./detectThinOrEmptyResult";
import type { ResearchChannel, ResearchPlan } from "./types";

// evaluateResearchCoverageが判断対象にする、収集済み記事1件分の最小限の情報。
// feed_items（RSS由来）・research_results（検索・公式サイト由来）の両方を
// この共通の形に変換してから渡す。
export interface CoverageItem {
  title: string;
  snippet: string | null;
  channel: ResearchChannel | null;
  publishedAt: string | null;
  imageUrl: string | null;
}

export type ResearchCoverageMissingAspect =
  | "results_too_few"
  | "missing_official_channel"
  | "missing_event_channel"
  | "missing_must_include_signals"
  | "stale_results_only"
  // event_site/ticket_site系の結果はあるが、公演日・会場・受付等の具体情報が
  // 確認できる項目が1つも無い（＝空のイベントページばかり）場合。
  | "empty_event_results"
  // 現在・今後を重視するトピックなのに、中身のある（薄くない）情報が少ない場合。
  // このアスペクトが立つと、探索範囲を過去の関連エピソード・共演・インタビュー等へ
  // 広げる補助検索（ResearchExpansionPolicy）のトリガーになる。
  | "fresh_current_info_insufficient";

export interface ResearchCoverageEvaluation {
  isSufficient: boolean;
  missingAspects: ResearchCoverageMissingAspect[];
  suggestedFollowUpQueries: string[];
  suggestedChannels: ResearchChannel[];
  warnings: string[];
  reason: string;
}

export interface EvaluateResearchCoverageInput {
  topicName: string;
  understanding: TopicUnderstanding;
  researchPlan: ResearchPlan;
  todayDate: string;
  items: CoverageItem[];
}

const MIN_TOTAL_RESULTS = 3;
const DEFAULT_STALE_THRESHOLD_DAYS = 60;
const EVENT_RELATED_NEEDS = ["upcoming_events", "detailed_event_info", "tickets"];
// 現在・今後を重視するトピックで「中身のある情報」がこの件数未満なら、
// 探索範囲を過去の関連エピソードへ広げる対象とする。
const MIN_RICH_ITEMS_FOR_FRESHNESS = 3;

// 初期収集結果（RSS＋非モックのresearch_results）が十分かどうかを、AI呼び出しを
// 追加せずルールベースで判定する。判定観点はユーザー指示に沿った以下の通り:
// 件数・公式情報の有無・イベント情報の有無・mustIncludeSignalsとの一致・
// 情報が古いものばかりでないか・画像付き候補の有無・mustExcludeSignalsに偏っていないか。
// AI呼び出しのコストを避けるため、ここでは一切AIを呼ばない（純粋な関数）。
export function evaluateResearchCoverage(
  input: EvaluateResearchCoverageInput,
): ResearchCoverageEvaluation {
  const { researchPlan, understanding, items, todayDate } = input;
  const missingAspects: ResearchCoverageMissingAspect[] = [];
  const suggestedFollowUpQueries: string[] = [];
  const suggestedChannels: ResearchChannel[] = [];
  const warnings: string[] = [];

  const entityLabel = understanding.entityName || input.topicName;
  const locationLabel = understanding.locationIntent.locationText;

  // 1. 件数が少なすぎないか
  if (items.length < MIN_TOTAL_RESULTS) {
    missingAspects.push("results_too_few");
    suggestedFollowUpQueries.push(...researchPlan.searchQueries.slice(0, 3), `${entityLabel} 最新情報`);
    suggestedChannels.push("brave_search");
  }

  // 2. 公式情報が不足していないか（ResearchPlanが公式サイトを重視している場合のみ判定する）
  if (researchPlan.preferredChannels.includes("official_site")) {
    const hasOfficial = items.some((i) => i.channel === "official_site");
    if (!hasOfficial) {
      missingAspects.push("missing_official_channel");
      suggestedFollowUpQueries.push(
        ...researchPlan.officialSiteQueries.slice(0, 3),
        `${entityLabel} 公式`,
        `${entityLabel} 公式 発表`,
      );
      suggestedChannels.push("official_site");
    }
  }

  // 3. イベント情報が不足していないか（ResearchPlanがイベント系クエリを持っている場合のみ）
  if (
    researchPlan.eventQueries.length > 0 &&
    understanding.informationNeeds.some((n) => EVENT_RELATED_NEEDS.includes(n))
  ) {
    const hasEvent = items.some((i) => i.channel === "event_site");
    if (!hasEvent) {
      missingAspects.push("missing_event_channel");
      suggestedFollowUpQueries.push(
        ...researchPlan.eventQueries.slice(0, 3),
        `${entityLabel} イベント`,
        `${entityLabel} チケット`,
      );
      suggestedChannels.push("event_site");
    }
  }

  // 4. mustIncludeSignalsに合う情報があるか（地域トピックはlocationTextも手がかりに含める）
  if (researchPlan.mustIncludeSignals.length > 0) {
    const lowerSignals = researchPlan.mustIncludeSignals.map((s) => s.toLowerCase());
    const matched = items.some((i) => {
      const text = `${i.title} ${i.snippet ?? ""}`.toLowerCase();
      return lowerSignals.some((s) => s && text.includes(s));
    });
    if (!matched) {
      missingAspects.push("missing_must_include_signals");
      suggestedFollowUpQueries.push(
        ...researchPlan.mustIncludeSignals
          .slice(0, 3)
          .map((s) => (locationLabel ? `${locationLabel} ${s}` : `${entityLabel} ${s}`)),
      );
    }
  }

  // 5. 情報が古いものばかりでないか（historicalを許容するトピックでは判定しない）
  if (!researchPlan.freshnessPolicy.allowHistorical && items.length > 0) {
    const maxAgeDays = researchPlan.freshnessPolicy.maxAgeDays ?? DEFAULT_STALE_THRESHOLD_DAYS;
    const todayMs = new Date(todayDate).getTime();
    const withDates = items.filter((i) => i.publishedAt);
    if (withDates.length > 0) {
      const allStale = withDates.every((i) => {
        const t = new Date(i.publishedAt as string).getTime();
        if (Number.isNaN(t)) return false;
        return (todayMs - t) / (1000 * 60 * 60 * 24) > maxAgeDays;
      });
      if (allStale) {
        missingAspects.push("stale_results_only");
        suggestedFollowUpQueries.push(`${entityLabel} 最新`, `${entityLabel} 今後の予定`);
        suggestedChannels.push("brave_search");
      }
    }
  }

  // 6. 画像付き候補が少なすぎないか（不足判断には含めない軽微な警告のみ）
  if (items.length > 0 && items.every((i) => !i.imageUrl)) {
    warnings.push("画像付きの候補が見つかりませんでした。");
  }

  // 7. mustExcludeSignalsに近い情報ばかりでないか（不足判断には含めない軽微な警告のみ）
  if (researchPlan.mustExcludeSignals.length > 0 && items.length > 0) {
    const lowerExclude = researchPlan.mustExcludeSignals.map((s) => s.toLowerCase());
    const excludeLikeCount = items.filter((i) => {
      const text = `${i.title} ${i.snippet ?? ""}`.toLowerCase();
      return lowerExclude.some((s) => s && text.includes(s));
    }).length;
    if (excludeLikeCount / items.length > 0.5) {
      warnings.push("除外すべき方向性に近い情報が多く含まれています。");
    }
  }

  // 8. event_site/ticket_site系の結果はあるが、公演日・会場・受付等の具体情報が
  // 1つも確認できない（＝空のイベント・チケットページばかり）場合。
  // 「公式」「チケット」「イベント」というchannelラベルだけで価値があると判断せず、
  // 中身の具体性を見る（detectThinOrEmptyResult）。
  const eventLikeItems = items.filter(
    (i) => i.channel === "event_site" || i.channel === "ticket_site",
  );
  if (eventLikeItems.length > 0) {
    const allThin = eventLikeItems.every(
      (i) => detectThinOrEmptyResult({ title: i.title, snippet: i.snippet, channel: i.channel }).isThin,
    );
    if (allThin) {
      missingAspects.push("empty_event_results");
      warnings.push(
        "イベント・チケット系の結果はありましたが、具体的な公演情報が確認できませんでした。",
      );
      suggestedFollowUpQueries.push(
        `${entityLabel} 過去 共演`,
        `${entityLabel} インタビュー`,
        `${entityLabel} プロフィール`,
      );
      suggestedChannels.push("social_or_video", "general_web");
    }
  }

  // 9. 現在・今後を重視するトピックなのに、中身のある（薄くない）情報が少ない場合。
  // 空の最新情報ページを無理に出すより、過去の共演・インタビュー・功績・逸話等の
  // 関連情報の方がユーザーにとって魅力的なことが多い（活動が少ない人物トピック等）。
  // ここで探索範囲を広げても、実際に「最新情報のように見せない」判断は
  // カード生成側（isFollowUpフラグ）に委ねる。
  if (
    (researchPlan.freshnessPolicy.preferFuture || !researchPlan.freshnessPolicy.allowHistorical) &&
    items.length > 0
  ) {
    const richItemCount = items.filter(
      (i) => !detectThinOrEmptyResult({ title: i.title, snippet: i.snippet, channel: i.channel }).isThin,
    ).length;
    if (richItemCount < MIN_RICH_ITEMS_FOR_FRESHNESS) {
      missingAspects.push("fresh_current_info_insufficient");
      suggestedFollowUpQueries.push(
        `${entityLabel} 過去 共演`,
        `${entityLabel} インタビュー`,
        `${entityLabel} 代表作 エピソード`,
        `${entityLabel} プロフィール`,
      );
      suggestedChannels.push("social_or_video", "brave_search");
    }
  }

  const dedupedQueries = [...new Set(suggestedFollowUpQueries.filter(Boolean))];
  const dedupedChannels = [...new Set(suggestedChannels)];
  const isSufficient = missingAspects.length === 0;

  return {
    isSufficient,
    missingAspects,
    suggestedFollowUpQueries: dedupedQueries,
    suggestedChannels: dedupedChannels,
    warnings,
    reason: isSufficient
      ? "初期収集結果は主要な観点をカバーしています。"
      : `不足している観点: ${missingAspects.join(", ")}`,
  };
}
