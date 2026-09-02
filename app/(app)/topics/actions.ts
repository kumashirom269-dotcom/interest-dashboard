"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateSourceCandidatesWithAI,
  type GeneratedSourceCandidate,
} from "@/lib/ai/generateSourceCandidates";
import { normalizeYoutubeRssUrl } from "@/lib/rss/normalizeYoutubeRssUrl";
import { buildFallbackClassification, classifyTopic } from "@/lib/ai/classifyTopic";
import { mapSourceRow, type SourceRow, type SourceWithTopic } from "@/lib/sources/queries";
import {
  getTopicClassificationForTopic,
  upsertTopicClassification,
} from "@/lib/topic-classification/queries";
import type { TopicClassification } from "@/lib/topic-classification/types";
import {
  getTopicPreferenceSettingsForTopic,
  upsertTopicPreferenceSettings,
  type TopicPreferenceSettingsInput,
} from "@/lib/topic-preference-settings/queries";
import type { TopicPreferenceSettings } from "@/lib/topic-preference-settings/types";
import { generateTopicPreferenceCategories } from "@/lib/ai/generateTopicPreferenceCategories";
import { insertTopicPreferenceCategories } from "@/lib/topic-preferences/queries";
import type {
  GeneratedPreferenceCategory,
  TopicPreferenceCategory,
} from "@/lib/topic-preferences/types";
import { identifyTopicEntity } from "@/lib/ai/identifyTopicEntity";
import type {
  IdentifiedEntity,
  TopicIdentificationResult,
} from "@/lib/topic-identification/types";
import {
  findYouTubeChannelUrlInHistory,
  youtubeHandleLabel,
  type ParsedYoutubeChannelUrl,
} from "@/lib/youtube/parseYouTubeChannelUrl";
import { fetchYouTubeChannelName } from "@/lib/youtube/fetchYouTubeChannelName";
import { fetchAndSaveRssForSource } from "@/app/(app)/sources/actions";
import { getPreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import { getFeedItemsForTopic } from "@/lib/feed-items/queries";
import {
  clusterArticlesByTopicAndTitle,
  feedItemToClusterableArticle,
  researchResultToClusterableArticle,
  type ClusterableArticle,
} from "@/lib/recommendation-cards/clustering";
import { generateRecommendationCard } from "@/lib/ai/generateRecommendationCard";
import { createRecommendationCards, getSuppressedDedupeKeysForTopic } from "@/lib/recommendation-cards/queries";
import { computeDedupeKey, isMajorUpdateInformationType } from "@/lib/recommendation-cards/dedupeKey";
import { scoreInformationValue } from "@/lib/recommendation/scoreInformationValue";
import { requiresTier1, hostnameOf } from "@/lib/research-review/sourceTier";
import { buildHighRiskWarnings } from "@/lib/recommendation-cards/highRiskWarnings";
import { extractHazardClaimKey } from "@/lib/recommendation-cards/hazardClaims";
import {
  getSourceDomainPreferencesForTopic,
  domainPreferenceWeight,
} from "@/lib/source-domain-preferences/queries";
import { loadReactionSignalSummaryForUser } from "@/lib/reactions/loadReactionSignalSummary";
import { computePreferenceWeightFromSignals } from "@/lib/reactions/aggregateReactionSignals";
import { generateResearchPlan, buildFallbackResearchPlan } from "@/lib/ai/generateResearchPlan";
import { buildResearchQueriesFromPlan } from "@/lib/research/buildResearchQueriesFromPlan";
import { buildFollowUpQueries } from "@/lib/research/buildFollowUpQueries";
import {
  evaluateResearchCoverage,
  type CoverageItem,
  type ResearchCoverageEvaluation,
} from "@/lib/research/evaluateResearchCoverage";
import { insertResearchPlan } from "@/lib/research/planQueries";
import {
  insertResearchVettingResults,
  type NewVettingResultRecord,
} from "@/lib/research/vettingResultsQueries";
import {
  resolveResearchProvider,
  type ResearchProviderMode,
} from "@/lib/research/getResearchProvider";
import { insertResearchResults, enrichResearchResultsWithGenreInfo } from "@/lib/research/queries";
import { detectThinOrEmptyResult } from "@/lib/research/detectThinOrEmptyResult";
import type {
  NewResearchResult,
  ResearchChannel,
  ResearchExpansionPolicy,
  ResearchExpansionTrigger,
  ResearchPlan,
  ResearchProviderName,
} from "@/lib/research/types";
import {
  vetResearchCandidates,
  type VettingClusterInput,
  type VettingExcludeReason,
  type VettingJudgement,
} from "@/lib/ai/vetResearchCandidates";
import { discoverLinksForUrl } from "@/lib/web-discovery/discoverLinks";
import { isWebDiscoveryEligible } from "@/lib/web-discovery/eligibility";
import { fetchWebPageSummary } from "@/lib/web-discovery/fetchWebPageSummary";
import { AI_COST_SAVING_MODE, AI_LIMITS } from "@/lib/config/aiLimits";
import { checkAndRecordRateLimit, type RateLimitWindow } from "@/lib/rate-limit/queries";
import { isAiCreditOrBillingError } from "@/lib/ai/aiErrorHelpers";
import type { InformationType } from "@/lib/recommendation-cards/types";
import type { FetchMethod, Topic } from "@/types/domain";
import { getGenreConfig } from "@/lib/genres/genreConfigs";
import { selectCardImage } from "@/lib/images/selectCardImage";
import type { ImageCandidate } from "@/lib/images/evaluateImages";
import type { FreshnessProfile } from "@/lib/topic-classification/types";

export interface TopicInput {
  name: string;
  description: string;
  keywords: string[];
}

interface TopicRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  keywords: string[] | null;
  last_collected_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapTopicRow(row: TopicRow): Topic {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? "",
    keywords: row.keywords ?? [],
    last_collected_at: row.last_collected_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getAuthedUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

export async function createTopic(input: TopicInput): Promise<Topic> {
  const { supabase, userId } = await getAuthedUserId();

  const { data, error } = await supabase
    .from("topics")
    .insert({
      user_id: userId,
      name: input.name,
      description: input.description,
      keywords: input.keywords,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/topics");
  return mapTopicRow(data);
}

export async function updateTopic(
  topicId: string,
  input: TopicInput,
): Promise<Topic> {
  const { supabase, userId } = await getAuthedUserId();

  const { data, error } = await supabase
    .from("topics")
    .update({
      name: input.name,
      description: input.description,
      keywords: input.keywords,
    })
    .eq("id", topicId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/topics");
  return mapTopicRow(data);
}

export async function deleteTopic(topicId: string): Promise<void> {
  const { supabase, userId } = await getAuthedUserId();

  const { error } = await supabase
    .from("topics")
    .delete()
    .eq("id", topicId)
    .eq("user_id", userId);

  if (error) throw error;

  revalidatePath("/topics");
}

// トピック登録フローのレート制限（一般公開に向けた対応）。
// identifyTopicAction・previewTopicRegistrationはAI呼び出し1〜2回程度と比較的軽いが、
// 確認せず何度も叩ける導線のため合算して緩めに制限する。confirmTopicRegistrationは
// runInitialAutoCollection（AI呼び出し数回＋検索API呼び出し十数回）を伴う最も重い処理のため、
// より厳しく制限する。値は「通常利用では実質引っかからない・機械的な連打だけ止める」水準を狙う。
const TOPIC_PREVIEW_RATE_LIMIT_WINDOWS: RateLimitWindow[] = [
  { windowMs: 60 * 60 * 1000, maxCount: 40, label: "1時間あたり" },
  { windowMs: 24 * 60 * 60 * 1000, maxCount: 150, label: "1日あたり" },
];
const TOPIC_CONFIRM_RATE_LIMIT_WINDOWS: RateLimitWindow[] = [
  { windowMs: 60 * 60 * 1000, maxCount: 10, label: "1時間あたり" },
  { windowMs: 24 * 60 * 60 * 1000, maxCount: 30, label: "1日あたり" },
];

const PLACEHOLDER_ID_PATTERN = /x{4,}/i;

// AIが生成したrss_urlをそのまま信用せず、可能な範囲で安全性を高める。
// - YouTubeのURLが/channel/UCxxxx/形式ならchannel_idを確実に抽出できるため、そちらを優先する
// - "channel_id=UCxxxxx"のような明らかなプレースホルダーが含まれるrss_urlはnullにする
//   （実チャンネルIDが分からない場合にAIが架空のIDを生成してしまうケースへの対策）
function resolveSafeRssUrl(candidate: GeneratedSourceCandidate): string | null {
  if (candidate.source_type === "youtube_channel") {
    const derived = normalizeYoutubeRssUrl(candidate.url);
    if (derived) return derived;
  }

  if (candidate.rss_url && PLACEHOLDER_ID_PATTERN.test(candidate.rss_url)) {
    return null;
  }

  return candidate.rss_url;
}

// 有効なrss_urlがあれば'rss'、YouTubeなどRSS以外の手段が必要なものは'unsupported'
// （追加APIの導入が必要なため今回は自動取得しない）、それ以外は'manual'（手動確認が必要）とする。
function resolveFetchMethod(
  candidate: GeneratedSourceCandidate,
  safeRssUrl: string | null,
): FetchMethod {
  if (safeRssUrl) return "rss";
  if (candidate.source_type === "youtube_channel") return "unsupported";
  return "manual";
}

const OFFICIAL_SOURCE_TYPES: GeneratedSourceCandidate["source_type"][] = [
  "official_site",
  "official_blog",
  "official_news",
];

// AIはconfidence（このURL・情報源が実在する自信度）を毎回算出しているが、
// これまでreasonへの自然文埋め込みにしか使われていなかった。品質管理カラムに
// 反映することで、/sources画面で「確認が必要な候補」を自動的に見分けられるようにする。
//
// is_officialは、AIが生成したsource_typeの自己申告だけでは決めない（レビュー指摘#5）。
// identifyTopicEntity/classifyTopicで確定済みのofficialUrl（confirmedOfficialUrl）が
// 既にある場合、候補URLのホスト名がそれと一致しない限りis_officialにしない
// （AIが別ドメインのURLを生成しても、それをそのまま公式扱いしない）。
function buildQualityFields(
  candidate: GeneratedSourceCandidate,
  confirmedOfficialUrl?: string | null,
): {
  isOfficial: boolean;
  sourceReliabilityScore: number;
  needsReview: boolean;
  reviewReason: string | null;
} {
  const aiClaimsOfficial = OFFICIAL_SOURCE_TYPES.includes(candidate.source_type);
  const sourceReliabilityScore = Math.round(candidate.confidence * 100);

  const missingUrl = !candidate.url;
  const lowConfidence = candidate.confidence < 0.6;

  if (missingUrl) {
    return {
      isOfficial: false,
      sourceReliabilityScore,
      needsReview: true,
      reviewReason: "AIがURLの実在に自信を持てなかったため、URLが未設定です。",
    };
  }

  if (aiClaimsOfficial && confirmedOfficialUrl) {
    const confirmedHost = hostnameOf(confirmedOfficialUrl);
    const candidateHost = hostnameOf(candidate.url);
    const hostMatches =
      confirmedHost && candidateHost && (candidateHost === confirmedHost || candidateHost.endsWith(`.${confirmedHost}`));
    if (!hostMatches) {
      return {
        isOfficial: false,
        sourceReliabilityScore,
        needsReview: true,
        reviewReason: `確定済みの公式URL（${confirmedOfficialUrl}）と異なるドメインのため、公式候補として自動登録せずレビュー対象にしました。`,
      };
    }
  }

  if (lowConfidence) {
    return {
      isOfficial: aiClaimsOfficial,
      sourceReliabilityScore,
      needsReview: true,
      reviewReason: `AIの実在確信度が低い候補です（confidence: ${candidate.confidence.toFixed(2)}）。URLが正しいか確認してください。`,
    };
  }

  return { isOfficial: aiClaimsOfficial, sourceReliabilityScore, needsReview: false, reviewReason: null };
}

export async function generateSourceCandidates(
  topicId: string,
): Promise<SourceWithTopic[]> {
  const { supabase, userId } = await getAuthedUserId();

  const { data: topicRow, error: topicError } = await supabase
    .from("topics")
    .select("id, name, description, keywords")
    .eq("id", topicId)
    .eq("user_id", userId)
    .single();

  if (topicError) throw topicError;

  // 保存済みのAI分類結果・ユーザーの好み設定があれば、収集元候補生成の参考情報として渡す。
  // どちらも未設定の場合はtopic.nameだけの従来通りの生成になる。
  const [classification, preferences] = await Promise.all([
    getTopicClassificationForTopic(topicId),
    getTopicPreferenceSettingsForTopic(topicId),
  ]);

  // 既存のis_official=trueなsourcesのうち、確定済みの公式URL（identifyTopicEntity/
  // classifyTopicが確定させたofficialUrl）と異なるドメインのものを、needs_review側へ
  // 降格する（レビュー指摘#5。過去にAIが誤って別ドメインを公式登録してしまったケースへの
  // 事後是正。破壊的な削除は行わない）。
  if (classification?.officialUrl) {
    const confirmedHost = hostnameOf(classification.officialUrl);
    if (confirmedHost) {
      const { data: existingOfficialSources, error: existingOfficialError } = await supabase
        .from("sources")
        .select("id, url")
        .eq("user_id", userId)
        .eq("topic_id", topicId)
        .eq("is_official", true);
      if (!existingOfficialError) {
        const mismatchedIds = (existingOfficialSources ?? [])
          .filter((s) => {
            const host = hostnameOf(s.url as string);
            return !host || (host !== confirmedHost && !host.endsWith(`.${confirmedHost}`));
          })
          .map((s) => s.id as string);
        if (mismatchedIds.length > 0) {
          await supabase
            .from("sources")
            .update({
              is_official: false,
              needs_review: true,
              review_reason: `確定済みの公式URL（${classification.officialUrl}）と異なるドメインのため、公式扱いを解除しレビュー対象にしました。`,
            })
            .in("id", mismatchedIds)
            .eq("user_id", userId);
        }
      }
    }
  }

  const candidates = await generateSourceCandidatesWithAI({
    name: topicRow.name,
    description: topicRow.description ?? "",
    keywords: topicRow.keywords ?? [],
    classification: classification ?? undefined,
    preferences: preferences ?? undefined,
  });

  if (candidates.length === 0) return [];

  const { data, error } = await supabase
    .from("sources")
    .insert(
      candidates.map((c) => {
        const safeRssUrl = resolveSafeRssUrl(c);
        const quality = buildQualityFields(c, classification?.officialUrl);
        return {
          user_id: userId,
          topic_id: topicRow.id,
          name: c.name,
          url: c.url,
          rss_url: safeRssUrl,
          fetch_method: resolveFetchMethod(c, safeRssUrl),
          source_type: c.source_type,
          status: "candidate",
          reason: c.reason,
          priority: c.priority,
          source_score: 0,
          created_by_ai: true,
          is_official: quality.isOfficial,
          source_reliability_score: quality.sourceReliabilityScore,
          needs_review: quality.needsReview,
          review_reason: quality.reviewReason,
        };
      }),
    )
    .select("*, topics(name)");

  if (error) throw error;

  revalidatePath("/topics");
  revalidatePath("/sources");
  return (data ?? []).map((row) => mapSourceRow(row as unknown as SourceRow));
}

// トピック名をAIで分類し、topic_classificationsへupsert保存する（topic_idごとに最新1件のみ保持）。
export async function classifyTopicAction(
  topicId: string,
): Promise<TopicClassification> {
  const { supabase, userId } = await getAuthedUserId();

  const { data: topic, error } = await supabase
    .from("topics")
    .select("id, name")
    .eq("id", topicId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  let classification: TopicClassification;
  try {
    classification = await classifyTopic(topic.name);
  } catch {
    classification = buildFallbackClassification(topic.name);
  }

  const saved = await upsertTopicClassification(
    topicId,
    classification,
    classification,
  );

  revalidatePath("/topics");
  return saved;
}

// トピックごとの「AIにどう情報を選んでほしいか」の好み設定を保存する。
// 現時点ではDB保存のみで、収集元候補生成・記事最適化のロジックはまだこの設定を参照していない。
export async function updateTopicPreferencesAction(
  topicId: string,
  input: TopicPreferenceSettingsInput,
): Promise<TopicPreferenceSettings> {
  const { supabase, userId } = await getAuthedUserId();

  const { error } = await supabase
    .from("topics")
    .select("id")
    .eq("id", topicId)
    .eq("user_id", userId)
    .single();

  if (error) throw error;

  const saved = await upsertTopicPreferenceSettings(topicId, input);

  revalidatePath("/topics");
  return saved;
}

function buildYoutubeContextText(
  parsed: ParsedYoutubeChannelUrl,
  channelName: string | null,
): string {
  const lines = [
    "ユーザーはYouTubeチャンネルURLを追加情報として入力しました。",
    `URL: ${parsed.canonicalUrl}`,
    `YouTube ${parsed.type === "handle" ? "handle" : parsed.type === "channel_id" ? "channel_id" : parsed.type}: ${youtubeHandleLabel(parsed)}`,
  ];
  if (channelName) {
    lines.push(`このチャンネルのページから取得したチャンネル名: ${channelName}`);
  }
  lines.push(
    "これはYouTubeチャンネルを指している可能性が非常に高いため、人物名・キャラクター名・一般語としてではなく、YouTubeチャンネルまたはクリエイターとして優先的に特定してください。",
  );
  return lines.join("\n");
}

// AIがプロンプトの指示に従わず曖昧判定を返した場合の安全網。
// 有効なYouTubeチャンネルURLが検出されている場合、URLの種別はほぼ確定しているため、
// AIの判断を待たずシステム側で決定論的にidentifiedへ確定させる。
function buildForcedYoutubeIdentification(
  parsed: ParsedYoutubeChannelUrl,
  channelName: string | null,
  previousResult: TopicIdentificationResult,
): TopicIdentificationResult {
  const handleLabel = youtubeHandleLabel(parsed);
  const name = channelName ?? handleLabel;
  const confidence = channelName ? 0.9 : 0.75;

  return {
    inputText: previousResult.inputText,
    normalizedTopicName: name,
    identificationStatus: "identified",
    identifiedEntity: {
      name,
      entityType: "youtube_channel",
      description: channelName
        ? `YouTubeチャンネル「${channelName}」（${handleLabel}）`
        : `YouTube ${handleLabel} のチャンネル`,
      canonicalUrl: parsed.canonicalUrl,
      officialUrl: null,
      youtubeChannelUrl: parsed.canonicalUrl,
      confidence,
      topicKind: "entity_topic",
    },
    candidateEntities: [],
    clarificationQuestion: null,
    requestedAdditionalInfo: [],
    canProceedToPreferenceSelection: true,
    reason:
      "有効なYouTubeチャンネルURLが検出されたため、URL解析結果をもとにYouTubeチャンネルとして特定しました。",
  };
}

// トピック登録の「対象特定ゲート」。identificationStatusが"identified"かつ
// canProceedToPreferenceSelection===trueの場合のみ、呼び出し側は次（カテゴリ提案）へ
// 進んでよい。DBへは一切書き込まない（topic_registration_intents等の一時テーブルは使わず、
// 未確定状態は呼び出し元の画面stateだけで保持する最小実装）。
// additionalInfoHistoryには、ユーザーがneeds_more_info/needs_selectionを受けて
// 追加入力した内容を古い順に渡す（最大2回程度を想定。呼び出し元でラウンド数を管理する）。
//
// 追加情報にYouTubeチャンネルURL（@handle・channel_id・c・user形式）が含まれる場合は、
// AIに丸投げせずシステム側でまずURLを解析する。チャンネルURLとして妥当なら種別は
// ほぼ確定しているため、AIへは明示的な文脈を渡した上で、それでも曖昧判定が返ってきた
// 場合はURL解析結果をもとに決定論的にidentifiedへ確定させる。
export async function identifyTopicAction(
  input: TopicInput,
  additionalInfoHistory: string[] = [],
): Promise<TopicIdentificationResult> {
  const { supabase, userId } = await getAuthedUserId();

  const rateLimit = await checkAndRecordRateLimit(
    supabase,
    userId,
    "topic_registration_preview",
    TOPIC_PREVIEW_RATE_LIMIT_WINDOWS,
  );
  if (!rateLimit.allowed) {
    throw new Error(rateLimit.message);
  }

  const youtubeMatch = findYouTubeChannelUrlInHistory(additionalInfoHistory);
  let youtubeContext: string | undefined;
  let youtubeChannelName: string | null = null;

  if (youtubeMatch) {
    youtubeChannelName = await fetchYouTubeChannelName(youtubeMatch.canonicalUrl);
    youtubeContext = buildYoutubeContextText(youtubeMatch, youtubeChannelName);
  }

  const result = await identifyTopicEntity({
    name: input.name,
    description: input.description,
    keywords: input.keywords,
    additionalInfoHistory,
    youtubeContext,
  });

  if (youtubeMatch && result.identificationStatus !== "identified") {
    return buildForcedYoutubeIdentification(youtubeMatch, youtubeChannelName, result);
  }

  return result;
}

export interface TopicRegistrationPreview {
  classification: TopicClassification;
  categories: GeneratedPreferenceCategory[];
}

// identifiedEntity・追加情報から、classifyTopicへ渡す補足情報の文字列を組み立てる。
// これにより、トピック名単体では曖昧な短い名前（例:"shin"）でも、対象特定ゲートで
// 確定済みの文脈を踏まえて分類できるようにする。
function buildIdentifiedContext(
  identifiedEntity: IdentifiedEntity,
  additionalInfoHistory: string[],
): string {
  const lines = [
    `確定した対象: ${identifiedEntity.name}（${identifiedEntity.entityType}）`,
    `トピック種別（topicKind、必ずこの値をそのまま使うこと）: ${identifiedEntity.topicKind}`,
    `説明: ${identifiedEntity.description}`,
  ];
  if (identifiedEntity.officialUrl) lines.push(`公式サイト: ${identifiedEntity.officialUrl}`);
  if (identifiedEntity.youtubeChannelUrl) {
    lines.push(`YouTubeチャンネル: ${identifiedEntity.youtubeChannelUrl}`);
  }
  if (identifiedEntity.canonicalUrl) lines.push(`参考URL: ${identifiedEntity.canonicalUrl}`);

  if (additionalInfoHistory.length > 0) {
    lines.push("ユーザーが対象特定の確認時に入力した追加情報:");
    additionalInfoHistory.forEach((info, index) => {
      lines.push(`  ${index + 1}. ${info}`);
    });
  }

  return lines.join("\n");
}

// トピック登録の確認画面用に、対象特定ゲートで確定したidentifiedEntityをもとに
// AIでトピックを分類しつつ「集めたい情報カテゴリ」を8〜10個生成する。
// まだDBには一切書き込まない（ユーザーがカテゴリ選択を終えるまでtopicsテーブルに
// 行を作らない設計のため）。identifiedEntityを必須にすることで、対象特定ゲートを
// 経由せずにこの関数だけを呼び出すことを型レベルで防ぐ。
export async function previewTopicRegistration(
  input: TopicInput,
  identifiedEntity: IdentifiedEntity,
  additionalInfoHistory: string[] = [],
): Promise<TopicRegistrationPreview> {
  const { supabase, userId } = await getAuthedUserId();

  const rateLimit = await checkAndRecordRateLimit(
    supabase,
    userId,
    "topic_registration_preview",
    TOPIC_PREVIEW_RATE_LIMIT_WINDOWS,
  );
  if (!rateLimit.allowed) {
    throw new Error(rateLimit.message);
  }

  const context = buildIdentifiedContext(identifiedEntity, additionalInfoHistory);
  let classification: TopicClassification;
  try {
    classification = await classifyTopic(identifiedEntity.name || input.name, context);
  } catch {
    // AI呼び出し自体が失敗しても（クレジット残高不足等）、対象特定ゲートで既に
    // 確定済みのidentifiedEntityがあるため、以降のenrichedClassificationでの
    // 上書きにより登録自体は継続できる。
    classification = buildFallbackClassification(identifiedEntity.name || input.name, context);
  }

  const supplementaryNotes =
    additionalInfoHistory.length > 0
      ? `ユーザーが対象特定時に入力した追加情報: ${additionalInfoHistory.join(" / ")}`
      : classification.notes;

  // 対象特定ゲートで既に確定済みのため、classifyTopic自身が曖昧判定を返しても
  // （トピック名単体では"shin"のような短い名前が曖昧に見えるため）、それを信用せず
  // 確定済みの情報で必ず上書きする（identifyTopicEntity.identificationStatusが
  // "identified"の場合のみここへ来るため、常に確定扱いにしてよい）。
  const enrichedClassification: TopicClassification = {
    ...classification,
    needsUserConfirmation: false,
    ambiguityReason: undefined,
    candidateEntities: [],
    confidence: identifiedEntity.confidence,
    summary: identifiedEntity.description || classification.summary,
    notes: supplementaryNotes,
    identificationStatus: "identified",
    canonicalUrl: identifiedEntity.canonicalUrl ?? null,
    officialUrl: identifiedEntity.officialUrl ?? null,
    youtubeChannelUrl: identifiedEntity.youtubeChannelUrl ?? null,
    // topicKindは対象特定ゲート（identifyTopicEntity・ユーザーのcandidateEntities選択）で
    // 既に確定済みのため、classifyTopic自身の判定を信用せず必ず上書きする
    // （既存のneedsUserConfirmation/candidateEntities等の上書きと同じ方針）。
    understanding: {
      ...classification.understanding,
      topicKind: identifiedEntity.topicKind,
    },
  };

  const categories = await generateTopicPreferenceCategories({
    name: identifiedEntity.name || input.name,
    description: input.description,
    keywords: input.keywords,
    classification: enrichedClassification,
  });

  return { classification: enrichedClassification, categories };
}

// 確認画面でユーザーが確定した内容をもとに、topics / topic_classifications /
// topic_preferencesへまとめて保存する。previewTopicRegistrationで生成済みの
// classification・categoriesをそのまま受け取るため、追加のAI呼び出しは発生しない。
// classification.identificationStatusが"identified"でない場合は、クライアント側の
// バグや不正な呼び出しであっても登録が成立しないよう、サーバー側でも必ず拒否する。
const AUTO_ACTIVATE_RELIABILITY_THRESHOLD = 70;
// カード生成数・精査対象数・検索結果数・ページ要約取得数の上限は、すべて
// lib/config/aiLimits.ts（AI_LIMITS）で一元管理する。AI_COST_SAVING_MODEがONの開発中は
// これらが大きく絞られ、Anthropic APIの呼び出し回数・入出力トークン量を抑える。

// 画像が無い候補のうち、official_site/event_siteチャネル・検索順位の高いものを優先して
// 少数だけページ要約を取得し、fetched_page_*列を埋める。本格的なスクレイピングではなく、
// あくまで軽量な補助情報（title/description/og:image）の取得に留める。
async function enrichResultsWithPageSummaries(
  results: NewResearchResult[],
  maxFetches: number,
): Promise<NewResearchResult[]> {
  if (maxFetches <= 0 || results.length === 0) return results;

  const priorityChannels: ResearchChannel[] = ["official_site", "event_site"];
  const candidateIndexes = results
    .map((_, index) => index)
    .filter((index) => !results[index].imageUrl)
    .sort((a, b) => {
      const aChannel = results[a].channel;
      const bChannel = results[b].channel;
      const aPriority = aChannel && priorityChannels.includes(aChannel) ? 0 : 1;
      const bPriority = bChannel && priorityChannels.includes(bChannel) ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (results[a].rankingPosition ?? 99) - (results[b].rankingPosition ?? 99);
    })
    .slice(0, maxFetches);

  const enriched = [...results];
  for (const index of candidateIndexes) {
    const summary = await fetchWebPageSummary(enriched[index].url);
    enriched[index] = {
      ...enriched[index],
      fetchedPageTitle: summary.title,
      fetchedPageDescription: summary.description,
      fetchedImageUrl: summary.imageUrl,
      fetchStatus: summary.fetchStatus,
    };
  }

  return enriched;
}

const PRIORITY_CHANNELS_FOR_CAPPING: ResearchChannel[] = [
  "official_site",
  "event_site",
  "news_site",
];

// 検索結果が多すぎる場合（例: 1トピックで64件）、AI精査・カード生成へ渡す前に
// research_resultsへの保存件数自体をAI_LIMITS.maxResearchResultsPerTopicまで絞る。
// 公式・イベント・ニュース系チャネルと新しい記事を優先して残す。
function capResearchResultsForCostSaving(
  results: NewResearchResult[],
  maxCount: number,
): NewResearchResult[] {
  if (results.length <= maxCount) return results;

  const sorted = [...results].sort((a, b) => {
    const aPriority = a.channel && PRIORITY_CHANNELS_FOR_CAPPING.includes(a.channel) ? 0 : 1;
    const bPriority = b.channel && PRIORITY_CHANNELS_FOR_CAPPING.includes(b.channel) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  return sorted.slice(0, maxCount);
}

interface ClusterMetaEntry {
  index: number;
  cluster: ClusterableArticle[];
  representative: ClusterableArticle;
  clusterInput: VettingClusterInput;
}

// AI精査（vetResearchCandidates）に渡すクラスタ数をAI_LIMITS.maxClustersForVettingまで絞る。
// 公式・イベント・ニュース系チャネルを含むクラスタ、新しいもの、画像がある（＝情報が
// 具体的である可能性が高い）もの、タイトル・概要が空でないものを優先してAIに渡す。
// 選ばれなかったクラスタはAI精査を受けないが、除外はせずhold扱いにする
// （カード数が不足した場合のバックフィル候補として残す）。
function selectClustersForVetting(
  clusterMeta: ClusterMetaEntry[],
  maxClusters: number,
): { selected: ClusterMetaEntry[]; skipped: ClusterMetaEntry[] } {
  if (clusterMeta.length <= maxClusters) {
    return { selected: clusterMeta, skipped: [] };
  }

  const priorityChannelSet = new Set<ResearchChannel>(PRIORITY_CHANNELS_FOR_CAPPING);

  const scored = [...clusterMeta].sort((a, b) => {
    const aHasPriorityChannel = a.cluster.some(
      (item) => item.channel && priorityChannelSet.has(item.channel),
    )
      ? 0
      : 1;
    const bHasPriorityChannel = b.cluster.some(
      (item) => item.channel && priorityChannelSet.has(item.channel),
    )
      ? 0
      : 1;
    if (aHasPriorityChannel !== bHasPriorityChannel) {
      return aHasPriorityChannel - bHasPriorityChannel;
    }

    const aHasImage = a.cluster.some((item) => item.imageUrl) ? 0 : 1;
    const bHasImage = b.cluster.some((item) => item.imageUrl) ? 0 : 1;
    if (aHasImage !== bHasImage) return aHasImage - bHasImage;

    // 明らかに空のイベント・チケットページ等（detectThinOrEmptyResult）は、限られた
    // AI精査枠を使う優先度を下げる（どうせexclude/holdになりやすいため）。
    const aThin = detectThinOrEmptyResult({
      title: a.clusterInput.representativeTitle,
      snippet: a.clusterInput.representativeSummary,
      channel: a.clusterInput.channel ?? null,
    }).isThin
      ? 1
      : 0;
    const bThin = detectThinOrEmptyResult({
      title: b.clusterInput.representativeTitle,
      snippet: b.clusterInput.representativeSummary,
      channel: b.clusterInput.channel ?? null,
    }).isThin
      ? 1
      : 0;
    if (aThin !== bThin) return aThin - bThin;

    if (b.clusterInput.itemCount !== a.clusterInput.itemCount) {
      return b.clusterInput.itemCount - a.clusterInput.itemCount;
    }

    const aTime = a.clusterInput.publishedAt ? new Date(a.clusterInput.publishedAt).getTime() : 0;
    const bTime = b.clusterInput.publishedAt ? new Date(b.clusterInput.publishedAt).getTime() : 0;
    return bTime - aTime;
  });

  return {
    selected: scored.slice(0, maxClusters),
    skipped: scored.slice(maxClusters),
  };
}

// generateRecommendationCardのAI呼び出しが失敗した場合（クレジット残高不足等）の
// 簡易カード。代表記事のタイトル・概要をそのまま使い、AIによる再構成は行わない。
function buildFallbackCardContent(representative: ClusterableArticle): {
  generatedTitle: string;
  generatedSummary: string;
  displayReason: string;
  informationType: InformationType;
} {
  return {
    generatedTitle: representative.title,
    generatedSummary:
      representative.summary ||
      "詳細は元記事でご確認ください（AIによる要約生成に失敗したため簡易表示です）。",
    displayReason: "AIによるおすすめ理由の生成に失敗したため、元記事の情報をそのまま表示しています。",
    informationType: "other",
  };
}

// ResearchPlanはDBへ永続化しない（今回のスコープ外）ため、登録直後の画面・debug APIへ
// 橋渡しできるのはこの1回のパイプライン実行の間だけ。再訪時にresearch_resultsから
// 遡って確認できるのは、各行のchannel・queryのみ（研究計画そのものは失われる）。
export interface ResearchPlanSummary {
  primaryGoal: string;
  preferredChannels: ResearchChannel[];
  searchQueries: string[];
  officialSiteQueries: string[];
  eventQueries: string[];
  notesForVetting: string;
  expansionPolicy: ResearchExpansionPolicy;
}

export interface AutoCollectionResult {
  ok: boolean;
  sourceCandidatesGenerated: number;
  sourcesAutoActivated: number;
  rssSourcesFetched: number;
  feedItemsFetched: number;
  researchQueriesGenerated: number;
  officialSiteResultsFound: number;
  researchResultsSaved: number;
  realResearchResultsForCards: number;
  mockResearchResultsExcluded: number;
  clusteringInputCount: number;
  recommendationCardsCreated: number;
  providerName: ResearchProviderName;
  providerMode: ResearchProviderMode;
  missingApiKey: boolean;
  researchPlanSummary: ResearchPlanSummary | null;
  // ResearchPlanの永続化に成功した場合のid（research_plansテーブルの行）。
  // 失敗した場合はnullのままパイプラインを続行する。
  researchPlanId: string | null;
  // 初期収集結果の不足判断（evaluateResearchCoverage）の結果。
  coverageEvaluation: ResearchCoverageEvaluation | null;
  followUpQueriesExecuted: number;
  followUpResultsSaved: number;
  vettingResultsSaved: number;
  // API節約モード（lib/config/aiLimits.ts）に関する情報。DBへは永続化しないため、
  // ここ（登録直後の画面）でのみ確認できる。
  aiCostSavingMode: boolean;
  researchResultsLimitedFrom: number | null;
  researchResultsLimitedTo: number | null;
  vettingBatchCount: number;
  vettingFailedBatchCount: number;
  vettingParseErrorCount: number;
  cardsGeneratedByFallback: number;
  warnings: string[];
  error?: string;
}

// SupabaseのPostgrestError等、Error のインスタンスではないが message プロパティを
// 持つ例外を投げるライブラリがあるため、instanceof Error だけで判定すると
// 「自動収集パイプラインの実行に失敗しました」という無意味な汎用メッセージに
// フォールバックしてしまい、実際の原因（未適用のmigration、制約違反等）が分からなくなる。
// message プロパティがあればそれを、なければJSON化を試み、最後だけ汎用文言にする。
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const message = (e as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  try {
    const serialized = JSON.stringify(e);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // ignore
  }
  return "自動収集パイプラインの実行に失敗しました（詳細不明）";
}

// トピック登録直後に、裏側で自動的に
// 「収集元候補生成 → 信頼度の高い候補のみ自動active化 → RSS取得 → 記事クラスタリング →
// おすすめカード生成 → last_collected_at更新」までを一括実行する（Phase1の自動収集）。
// sourcesは絶対的な収集元リストではなく「過去に有用だった参考情報」という位置づけのため、
// ここで自動active化するのは信頼度が高いと判定された候補のみに限定する
// （is_official かつ source_reliability_score が閾値以上。それ以外はcandidateのまま残り、
// 従来通り/sourcesで人間が確認してから手動でactiveにできる）。
// 途中でAI呼び出し等が失敗しても、トピック自体の登録は既に完了しているため例外を再送出せず、
// 結果に含めて返す（Server Actionの1回の呼び出し内で同期的に実行する最小実装。
// 将来的にはqueue/cron化する前提で、この関数単位のまま切り出せるようにしてある）。
async function runInitialAutoCollection(
  topicId: string,
  classification: TopicClassification,
  categories: TopicPreferenceCategory[],
): Promise<AutoCollectionResult> {
  const { provider, mode, missingApiKey } = resolveResearchProvider();

  const result: AutoCollectionResult = {
    ok: true,
    sourceCandidatesGenerated: 0,
    sourcesAutoActivated: 0,
    rssSourcesFetched: 0,
    feedItemsFetched: 0,
    researchQueriesGenerated: 0,
    officialSiteResultsFound: 0,
    researchResultsSaved: 0,
    realResearchResultsForCards: 0,
    mockResearchResultsExcluded: 0,
    clusteringInputCount: 0,
    recommendationCardsCreated: 0,
    providerName: provider.name,
    providerMode: mode,
    missingApiKey,
    researchPlanSummary: null,
    researchPlanId: null,
    coverageEvaluation: null,
    followUpQueriesExecuted: 0,
    followUpResultsSaved: 0,
    vettingResultsSaved: 0,
    aiCostSavingMode: AI_COST_SAVING_MODE,
    researchResultsLimitedFrom: null,
    researchResultsLimitedTo: null,
    vettingBatchCount: 0,
    vettingFailedBatchCount: 0,
    vettingParseErrorCount: 0,
    cardsGeneratedByFallback: 0,
    warnings: [],
  };

  if (AI_COST_SAVING_MODE) {
    result.warnings.push(
      `API節約モード: ON（検索クエリ最大${AI_LIMITS.maxBraveQueriesPerTopic}件、精査対象最大${AI_LIMITS.maxClustersForVetting}件、カード最大${AI_LIMITS.maxCardsPerTopic}件に制限しています）。`,
    );
  }

  try {
    const { supabase, userId } = await getAuthedUserId();

    // 1. 収集元候補生成
    let candidates: SourceWithTopic[] = [];
    try {
      candidates = await generateSourceCandidates(topicId);
      result.sourceCandidatesGenerated = candidates.length;
    } catch (e) {
      result.warnings.push(`収集元候補の生成に失敗しました: ${getErrorMessage(e)}`);
    }

    // 2. 信頼度の高い候補のみ自動active化
    const toActivate = candidates.filter(
      (c) =>
        c.is_official === true &&
        (c.source_reliability_score ?? 0) >= AUTO_ACTIVATE_RELIABILITY_THRESHOLD,
    );

    if (toActivate.length > 0) {
      try {
        const { error: activateError } = await supabase
          .from("sources")
          .update({ status: "active" })
          .in(
            "id",
            toActivate.map((c) => c.id),
          )
          .eq("user_id", userId);
        if (activateError) throw activateError;
        result.sourcesAutoActivated = toActivate.length;
      } catch (e) {
        result.warnings.push(`収集元の自動active化に失敗しました: ${getErrorMessage(e)}`);
      }
    }

    // 3. RSS取得可能な自動active化済みsourceだけ、その場でRSS取得する
    const rssSources = toActivate.filter((c) => c.fetch_method === "rss" && c.rss_url);

    if (rssSources.length > 0) {
      try {
        const preferredLanguage = await getPreferredFeedLanguageForUser();
        for (const source of rssSources) {
          if (!source.rss_url) continue;
          const fetchResult = await fetchAndSaveRssForSource(
            supabase,
            userId,
            {
              id: source.id,
              topic_id: source.topic_id,
              name: source.name,
              rss_url: source.rss_url,
            },
            preferredLanguage,
          );
          result.rssSourcesFetched += 1;
          result.feedItemsFetched += fetchResult.savedItemCount;
          if (fetchResult.status === "failed") {
            result.warnings.push(
              `RSS取得に失敗しました（${source.name}）: ${fetchResult.errorMessage ?? "不明なエラー"}`,
            );
          }
        }
      } catch (e) {
        result.warnings.push(`RSS取得処理に失敗しました: ${getErrorMessage(e)}`);
      }
    }

    // 4. research-based collection: sourcesに登録されていない情報も広く拾うため、
    // まずAIにこのトピックの「リサーチ方針」（ResearchPlan）を立てさせ、
    // RSS・Brave検索・公式サイト直接クロールを、その方針に基づく複数チャネルの
    // 一部として実行する（RSS・Brave検索だけに限定しない構造）。
    // APIキー未設定時はMockResearchProviderが返る。モックの結果は明らかに架空の
    // プレースホルダーであり、実在する情報のように見せるとユーザーに誤解を与えるため、
    // research_resultsへの保存はするが（動作確認・将来のdebug表示用）、
    // おすすめカード生成の材料には使わない（provider !== "mock"のもののみ使う）。
    const feedItemsSoFar = await getFeedItemsForTopic(topicId);

    // リアクション学習（like/dislike/save/hide）の集計。取得に失敗してもパイプライン全体を
    // 止めない（新規ユーザー等、リアクション履歴が無い場合は中立値50が使われる）。
    const reactionSignalSummary = await loadReactionSignalSummaryForUser().catch(() => null);
    const preferredInformationTypeWeight = reactionSignalSummary
      ? computePreferenceWeightFromSignals(reactionSignalSummary, {
          genreId: classification.understanding.primaryGenreId,
          informationTypes: classification.understanding.informationTypes,
        })
      : undefined;

    // research_results由来カードのリアクションから集計したドメイン単位の嗜好
    // （lib/source-domain-preferences/queries.ts、レビュー指摘#4）を、Research Plan生成の
    // ヒントとして反映する。取得失敗時はヒント無しで続行する。
    const domainPreferences = await getSourceDomainPreferencesForTopic(supabase, userId, topicId).catch(() => []);
    const preferredDomains = domainPreferences
      .filter((d) => d.positiveScore - d.negativeScore >= 5)
      .sort((a, b) => b.positiveScore - b.negativeScore - (a.positiveScore - a.negativeScore))
      .slice(0, 5)
      .map((d) => d.domain);
    const avoidedDomains = domainPreferences
      .filter((d) => d.negativeScore - d.positiveScore >= 5)
      .sort((a, b) => b.negativeScore - b.positiveScore - (a.negativeScore - a.positiveScore))
      .slice(0, 5)
      .map((d) => d.domain);

    let researchPlan: ResearchPlan;
    try {
      researchPlan = await generateResearchPlan({
        topicId,
        topicName: classification.topicName,
        classification,
        categories,
        preferredInformationTypeWeight,
        preferredDomains,
        avoidedDomains,
        currentDate: new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()),
        timezone: "Asia/Tokyo",
      });
    } catch (e) {
      result.warnings.push(
        `リサーチ方針の生成に失敗したため、簡易な方針にフォールバックしました: ${getErrorMessage(e)}`,
      );
      researchPlan = buildFallbackResearchPlan({
        topicId,
        topicName: classification.topicName,
        classification,
      });
    }

    result.researchPlanSummary = {
      primaryGoal: researchPlan.primaryGoal,
      preferredChannels: researchPlan.preferredChannels,
      searchQueries: researchPlan.searchQueries,
      officialSiteQueries: researchPlan.officialSiteQueries,
      eventQueries: researchPlan.eventQueries,
      notesForVetting: researchPlan.notesForVetting,
      expansionPolicy: researchPlan.expansionPolicy,
    };

    // 4a. ResearchPlan自体をDBへ永続化する。以前はAutoCollectionResult経由で
    // 登録直後の画面にしか橋渡しできず、後から「なぜこの情報が集まったのか」を
    // 追えなかったため、research_plansテーブルへ1行残す（追記のみ、更新はしない）。
    // 保存に失敗しても、research_plan_idをnullのままパイプライン自体は続行する。
    let persistedPlanId: string | null = null;
    try {
      const persistedPlan = await insertResearchPlan(researchPlan);
      persistedPlanId = persistedPlan.id;
      result.researchPlanId = persistedPlanId;
    } catch (e) {
      result.warnings.push(`リサーチ方針の保存に失敗しました: ${getErrorMessage(e)}`);
    }

    const plannedQueries = buildResearchQueriesFromPlan(
      researchPlan,
      classification.understanding.searchHints,
    );
    result.researchQueriesGenerated = plannedQueries.length;

    const researchResultsFound: NewResearchResult[] = [];
    for (const planned of plannedQueries) {
      try {
        const found = await provider.search(
          planned.query,
          topicId,
          AI_LIMITS.maxResultsPerBraveQuery,
        );
        // providerはチャネルを意識しないため、どのクエリバケット
        // （officialSiteQueries/eventQueries/searchQueries）から実行されたかに応じて
        // 呼び出し元でchannelを確定させる。research_plan_idも合わせて確定させる。
        researchResultsFound.push(
          ...found.map((r) => ({ ...r, channel: planned.channel, researchPlanId: persistedPlanId })),
        );
      } catch (e) {
        result.warnings.push(
          `検索（${planned.query.query}）に失敗しました: ${getErrorMessage(e)}`,
        );
      }
    }

    // 4b. official_siteチャネル: 検索APIではなく、信頼度の高い公式サイトを
    // lib/web-discovery/discoverLinksForUrl で直接クロールし、新着っぽいリンクを
    // research_resultsへ候補として取り込む（AIによるブラウザ操作等は行わない、
    // 既存の正規表現ベースのリンク抽出をそのまま再利用する）。
    // 対象はis_official && is_web_discovery_eligibleな候補のみ、かつ最大2件に絞り、
    // 外部サイトへの負荷・実行時間を抑える。
    if (researchPlan.preferredChannels.includes("official_site")) {
      const officialCandidates = candidates
        .filter((c) => c.is_official === true && c.url && isWebDiscoveryEligible(c))
        .slice(0, 2);

      for (const source of officialCandidates) {
        try {
          const discovery = await discoverLinksForUrl(source.id, source.name, source.url);
          if (discovery.status !== "success") {
            result.warnings.push(
              `公式サイトのクロールに失敗しました（${source.name}）: ${discovery.errorMessage ?? "不明なエラー"}`,
            );
            continue;
          }

          let sourceDomain: string | null = null;
          try {
            sourceDomain = new URL(source.url).hostname;
          } catch {
            sourceDomain = null;
          }

          const officialResults: NewResearchResult[] = discovery.discoveredLinks.map((link) => ({
            topicId,
            query: `official_site:${source.name}`,
            provider: "official_site" as const,
            resultType: "official_page" as const,
            title: link.title,
            url: link.url,
            snippet: null,
            sourceName: source.name,
            sourceDomain,
            authorName: null,
            publishedAt: null,
            rankingPosition: null,
            popularityScore: null,
            credibilityScore: 80,
            relevanceScore: link.score,
            freshnessScore: null,
            imageUrl: null,
            rawMetadata: { matchedKeyword: link.matchedKeyword, discoveryScore: link.score },
            channel: "official_site" as const,
            researchPlanId: persistedPlanId,
            isFollowUp: false,
            followUpReason: null,
            fetchedPageTitle: null,
            fetchedPageDescription: null,
            fetchedImageUrl: null,
            fetchStatus: null,
          }));

          result.officialSiteResultsFound += officialResults.length;
          researchResultsFound.push(...officialResults);
        } catch (e) {
          result.warnings.push(
            `公式サイトのクロール処理に失敗しました（${source.name}）: ${getErrorMessage(e)}`,
          );
        }
      }
    }

    // API節約モードでは、research_resultsへの保存件数自体を絞る（公式・イベント・
    // ニュース系チャネル、新しい記事を優先）。1トピックで64件のような大量取得は、
    // 後段のAI精査・カード生成のコストを不必要に増やすため。
    const cappedResearchResultsFound = capResearchResultsForCostSaving(
      researchResultsFound,
      AI_LIMITS.maxResearchResultsPerTopic,
    );
    if (cappedResearchResultsFound.length < researchResultsFound.length) {
      result.researchResultsLimitedFrom = researchResultsFound.length;
      result.researchResultsLimitedTo = cappedResearchResultsFound.length;
      result.warnings.push(
        `API節約モードにより、検索結果を${researchResultsFound.length}件から${cappedResearchResultsFound.length}件に制限しました。`,
      );
    }

    // 画像の無い候補を中心に、少数だけページ要約（title/description/og:image）を取得する。
    const enrichedInitialResults = await enrichResultsWithPageSummaries(
      cappedResearchResultsFound,
      AI_LIMITS.maxPageSummariesToFetchInitial,
    );

    // sources.is_official=trueで既に確認済みの候補のホスト名一覧。sourceTier判定で
    // 「channelの主張」ではなく「確認済みの公式ドメイン」を根拠にするために使う。
    const knownOfficialDomains: string[] = candidates
      .filter((c) => c.is_official === true && c.url)
      .map((c) => {
        try {
          return new URL(c.url as string).hostname.toLowerCase();
        } catch {
          return null;
        }
      })
      .filter((h): h is string => h !== null);

    let savedResearchResults: Awaited<ReturnType<typeof insertResearchResults>> = [];
    if (enrichedInitialResults.length > 0) {
      try {
        const genreEnriched = enrichResearchResultsWithGenreInfo(enrichedInitialResults, {
          genreId: classification.understanding.primaryGenreId,
          informationTypes: classification.understanding.informationTypes,
          crossGenreTags: classification.understanding.crossGenreTags,
          riskLevel: getGenreConfig(classification.understanding.primaryGenreId)?.defaultRiskLevel ?? "normal",
          officialUrl: classification.officialUrl,
          knownOfficialDomains,
        });
        savedResearchResults = await insertResearchResults(topicId, genreEnriched);
        result.researchResultsSaved = savedResearchResults.length;
      } catch (e) {
        result.warnings.push(`検索結果の保存に失敗しました: ${getErrorMessage(e)}`);
      }
    }

    const usableResearchResults = savedResearchResults.filter(
      (r) => r.provider !== "mock",
    );
    result.realResearchResultsForCards = usableResearchResults.length;
    result.mockResearchResultsExcluded =
      savedResearchResults.length - usableResearchResults.length;

    if (mode === "mock" && savedResearchResults.length > 0) {
      result.warnings.push(
        "BRAVE_SEARCH_API_KEY が未設定のため、検索拡張リサーチはMockProviderで動作しました。Mock結果はユーザー向けカードには使用していません。",
      );
    }

    // 4c. 初期収集結果（RSS＋非モックのresearch_results）が十分かどうかを、
    // AI呼び出しを追加せずルールベースで判定する（Phase2）。不十分な場合は、
    // 判定結果が示す観点を補う追加検索を行う（Phase3。既存のResearchPlanの
    // クエリ・searchHints・prioritySignals由来のクエリのみを使い、新たなAI呼び出しは行わない）。
    const coverageItems: CoverageItem[] = [
      ...feedItemsSoFar.map((item) => ({
        title: item.title,
        snippet: item.summary,
        channel: "rss" as ResearchChannel,
        publishedAt: item.published_at,
        imageUrl: item.image_url ?? null,
      })),
      ...usableResearchResults.map((r) => ({
        title: r.title,
        snippet: r.snippet,
        channel: r.channel,
        publishedAt: r.publishedAt,
        imageUrl: r.imageUrl ?? r.fetchedImageUrl,
      })),
    ];

    const coverageEvaluation = evaluateResearchCoverage({
      topicName: classification.topicName,
      understanding: classification.understanding,
      researchPlan,
      todayDate: new Date().toISOString().slice(0, 10),
      items: coverageItems,
    });
    result.coverageEvaluation = coverageEvaluation;

    // 最新情報が少ない（fresh_current_info_insufficient）、またはイベント/チケット系の
    // 結果が空ばかり（empty_event_results）の場合、探索範囲を過去の共演・インタビュー・
    // 功績・逸話等へ広げる方針を立てる。追加のAI呼び出しは行わず、evaluateResearchCoverageが
    // 既に組み立てたsuggestedFollowUpQueries（ルールベース）をそのまま使う。
    // 注意: researchPlanは既にinsertResearchPlanでDBへ永続化済みのため、この時点での
    // expansionPolicy更新はDB上のraw_planには反映されない（メモリ上のみ・この実行内で
    // カード生成・debug用のresearchPlanSummaryにのみ反映される）。
    const expansionTrigger: ResearchExpansionTrigger =
      coverageEvaluation.missingAspects.includes("fresh_current_info_insufficient")
        ? "fresh_current_info_insufficient"
        : coverageEvaluation.missingAspects.includes("empty_event_results")
          ? "empty_event_results"
          : "none";

    if (expansionTrigger !== "none") {
      researchPlan.expansionPolicy = {
        enabled: true,
        trigger: expansionTrigger,
        expandedInformationNeeds: ["historical_background", "media_appearance"],
        expansionQueries: coverageEvaluation.suggestedFollowUpQueries.slice(
          0,
          AI_LIMITS.maxFollowUpQueries,
        ),
        explanation:
          expansionTrigger === "fresh_current_info_insufficient"
            ? "最新の活動情報が少ないため、過去の共演・インタビュー・功績等の関連情報へ探索範囲を広げました。"
            : "イベント・チケット系の結果はあったものの具体的な公演情報が確認できなかったため、過去の関連情報へ探索範囲を広げました。",
      };
      if (result.researchPlanSummary) {
        result.researchPlanSummary.expansionPolicy = researchPlan.expansionPolicy;
      }
      result.warnings.push(
        `最新情報が少ないため、探索範囲を過去の関連エピソード・共演・インタビュー等に広げました（トリガー: ${expansionTrigger}）。`,
      );
    }

    let usableFollowUpResults: Awaited<ReturnType<typeof insertResearchResults>> = [];
    if (!coverageEvaluation.isSufficient) {
      const followUpQueries = buildFollowUpQueries(coverageEvaluation, researchPlan);
      result.followUpQueriesExecuted = followUpQueries.length;

      if (followUpQueries.length > 0) {
        const followUpFound: NewResearchResult[] = [];
        for (const planned of followUpQueries) {
          try {
            const found = await provider.search(
              planned.query,
              topicId,
              AI_LIMITS.maxResultsPerBraveQuery,
            );
            followUpFound.push(
              ...found.map((r) => ({
                ...r,
                channel: planned.channel,
                researchPlanId: persistedPlanId,
                isFollowUp: true,
                followUpReason: planned.followUpReason,
              })),
            );
          } catch (e) {
            result.warnings.push(
              `追加検索（${planned.query.query}）に失敗しました: ${getErrorMessage(e)}`,
            );
          }
        }

        if (followUpFound.length > 0) {
          const enrichedFollowUp = await enrichResultsWithPageSummaries(
            followUpFound,
            AI_LIMITS.maxPageSummariesToFetchFollowUp,
          );
          try {
            const genreEnrichedFollowUp = enrichResearchResultsWithGenreInfo(enrichedFollowUp, {
              genreId: classification.understanding.primaryGenreId,
              informationTypes: classification.understanding.informationTypes,
              crossGenreTags: classification.understanding.crossGenreTags,
              riskLevel: getGenreConfig(classification.understanding.primaryGenreId)?.defaultRiskLevel ?? "normal",
              officialUrl: classification.officialUrl,
              knownOfficialDomains,
            });
            const savedFollowUp = await insertResearchResults(topicId, genreEnrichedFollowUp);
            result.followUpResultsSaved = savedFollowUp.length;
            usableFollowUpResults = savedFollowUp.filter((r) => r.provider !== "mock");
            result.warnings.push(
              `不足判断（${coverageEvaluation.missingAspects.join(", ")}）を受けて追加検索を実行し、${savedFollowUp.length}件を追加しました。`,
            );
          } catch (e) {
            result.warnings.push(`追加検索結果の保存に失敗しました: ${getErrorMessage(e)}`);
          }
        }
      }
    }

    // 5. 取得できた記事・（mock以外の）検索結果・追加検索結果をクラスタリングし、
    // おすすめカードを生成する
    const clusterableItems = [
      ...feedItemsSoFar.map(feedItemToClusterableArticle),
      ...usableResearchResults.map(researchResultToClusterableArticle),
      ...usableFollowUpResults.map(researchResultToClusterableArticle),
    ];
    result.clusteringInputCount = clusterableItems.length;

    if (clusterableItems.length > 0) {
      const genreConfigForClustering = getGenreConfig(classification.understanding.primaryGenreId);
      const allClusters = clusterArticlesByTopicAndTitle(clusterableItems, {
        entityName: classification.understanding.entityName,
        hasEventLikeNormalizationKey: genreConfigForClustering?.normalizationKeys.some((k) =>
          k.includes("event"),
        ),
      });

      // Brave検索・RSSで取得できたというだけでカード化しない。AIに各クラスタ（話題の
      // まとまり）を精査させ、関連度・鮮度（timeIntent/freshnessProfileを踏まえた
      // 古さ）・信頼度・話題としての価値を判定し、excludeと判定されたものは使わない。
      // 精査AI自体が失敗した場合は、精査なし（全クラスタ採用）にフォールバックし、
      // カード生成自体は止めない。
      // 代表記事（representative）は精査AIへの入力とdebug永続化の両方で使うため、
      // クラスタごとに1回だけ計算して保持しておく。
      const clusterMeta: ClusterMetaEntry[] = allClusters.map((cluster, index) => {
        const representative = [...cluster].sort(
          (a, b) => b.summary.length - a.summary.length,
        )[0];
        const hasFeedItem = cluster.some((item) => item.origin === "feed_item");
        const hasResearchResult = cluster.some(
          (item) => item.origin === "research_result",
        );
        return {
          index,
          cluster,
          representative,
          clusterInput: {
            clusterIndex: index,
            representativeTitle: representative.title,
            representativeSummary: representative.summary,
            sourceNames: [...new Set(cluster.map((item) => item.sourceName))],
            publishedAt: representative.publishedAt || null,
            origin: (hasFeedItem && hasResearchResult
              ? "mixed"
              : hasFeedItem
                ? "feed_item"
                : "research_result") as "feed_item" | "research_result" | "mixed",
            itemCount: cluster.length,
            channel: representative.channel,
            isOfficialSource: representative.isOfficialSource,
            sourceTier: representative.sourceTier ?? undefined,
            informationTypes:
              representative.informationTypes.length > 0 ? representative.informationTypes : undefined,
          },
        };
      });

      // クラスタインデックス→判定のマップ。AI精査結果に加え、API節約モードで
      // 精査対象外としたクラスタも「hold」として先に埋めておく（除外はしない。
      // use判定だけでカード数が足りない場合のバックフィル候補として使うため）。
      const judgementByIndex = new Map<
        number,
        { judgement: VettingJudgement; reason: string; excludeReason?: VettingExcludeReason }
      >();

      if (clusterMeta.length > 0) {
        const { selected: clustersForVetting, skipped: clustersSkippedForVetting } =
          selectClustersForVetting(clusterMeta, AI_LIMITS.maxClustersForVetting);

        if (clustersSkippedForVetting.length > 0) {
          result.warnings.push(
            `API節約モードにより、AI精査対象を${clusterMeta.length}件から${clustersForVetting.length}件に制限しました（残り${clustersSkippedForVetting.length}件はhold扱いです）。`,
          );
          for (const m of clustersSkippedForVetting) {
            // AIに渡さない場合でも、明らかに空のイベント・チケットページ等はholdの
            // バックフィル候補にせずexcludeにする（空リンクを誤って表示しないため）。
            const thinSignal = detectThinOrEmptyResult({
              title: m.clusterInput.representativeTitle,
              snippet: m.clusterInput.representativeSummary,
              channel: m.clusterInput.channel ?? null,
            });
            if (thinSignal.isThin) {
              judgementByIndex.set(m.index, {
                judgement: "exclude",
                reason: `API節約モードにより精査対象外・かつ内容が薄いため除外: ${thinSignal.reasons.join("、")}`,
                excludeReason: "thin_content",
              });
            } else {
              judgementByIndex.set(m.index, {
                judgement: "hold",
                reason: "API節約モードにより精査対象外としたため、安全側でhold扱いにしました。",
              });
            }
          }
        }

        if (clustersForVetting.length > 0) {
          // vetResearchCandidates自体は例外を投げない設計（バッチ単位で失敗を吸収し、
          // 失敗分はhold扱いで返す）。念のためtry/catchで二重に保険をかける。
          try {
            const vettingOutput = await vetResearchCandidates({
              topicName: classification.topicName,
              classification,
              todayDate: new Date().toISOString().slice(0, 10),
              clusters: clustersForVetting.map((m) => m.clusterInput),
              researchPlan,
            });

            result.vettingBatchCount = vettingOutput.batchCount;
            result.vettingFailedBatchCount = vettingOutput.failedBatchCount;
            result.vettingParseErrorCount = vettingOutput.parseErrorCount;

            for (const v of vettingOutput.results) {
              judgementByIndex.set(v.clusterIndex, {
                judgement: v.judgement,
                reason: v.reason,
                excludeReason: v.excludeReason,
              });
            }

            if (vettingOutput.failedBatchCount > 0) {
              result.warnings.push(
                `リサーチ結果のAI精査で一部エラーが発生しました（${vettingOutput.failedBatchCount}/${vettingOutput.batchCount}バッチ）。失敗した候補は安全側でhold扱いにし、採用候補から優先度を下げました。`,
              );
              for (const f of vettingOutput.failures) {
                result.warnings.push(
                  `AI精査バッチ${f.batchIndex + 1}/${vettingOutput.batchCount}が失敗しました（${f.batchSize}件対象・${f.errorType}）: ${f.errorMessage}`,
                );
              }
            }

            const excludedCount = vettingOutput.results.filter(
              (v) => v.judgement === "exclude",
            ).length;
            if (excludedCount > 0) {
              result.warnings.push(
                `AIによる精査で${excludedCount}件の話題を除外しました（古い情報・関連度が低い等）。`,
              );
            }
          } catch (e) {
            for (const m of clustersForVetting) {
              judgementByIndex.set(m.index, {
                judgement: "hold",
                reason: `AI精査の呼び出しに失敗したため、安全側でhold: ${getErrorMessage(e)}`,
              });
            }
            result.warnings.push(
              `リサーチ結果の精査に失敗したため、該当候補を安全側でhold扱いにしました: ${getErrorMessage(e)}`,
            );
          }
        }

        // 精査結果（use/hold/exclude、除外理由）を後からdebugできるように永続化する。
        // なぜ採用/除外/保留されたのかを、negativeSignals/mustExcludeSignals等との
        // 単純な文字列一致で簡易的に裏付ける（matched_*_signalsとして保存）。
        // API節約モードで精査対象外としたクラスタもhold行として保存する。
        try {
          const positiveSignals = [
            ...researchPlan.mustIncludeSignals,
            ...classification.understanding.prioritySignals,
          ];
          const negativeSignals = [
            ...researchPlan.mustExcludeSignals,
            ...classification.understanding.negativeSignals,
          ];

          const vettingRecords: NewVettingResultRecord[] = clusterMeta.map((m) => {
            const v = judgementByIndex.get(m.index);
            const text = `${m.representative.title} ${m.representative.summary}`.toLowerCase();
            return {
              topicId,
              researchPlanId: persistedPlanId,
              clusterKey: m.cluster.map((item) => item.id).sort().join(","),
              judgement: v?.judgement ?? "hold",
              excludeReason: v?.excludeReason ?? null,
              reason: v?.reason ?? "判定が見つからなかったため、安全側でhold扱いにしました。",
              matchedPositiveSignals: positiveSignals.filter(
                (s) => s && text.includes(s.toLowerCase()),
              ),
              matchedNegativeSignals: negativeSignals.filter(
                (s) => s && text.includes(s.toLowerCase()),
              ),
              representativeTitle: m.representative.title,
              representativeUrl: m.representative.url,
              candidateCount: m.cluster.length,
            };
          });

          const savedVettingResults = await insertResearchVettingResults(vettingRecords);
          result.vettingResultsSaved = savedVettingResults.length;
        } catch (e) {
          result.warnings.push(`精査結果の保存に失敗しました: ${getErrorMessage(e)}`);
        }
      }

      // use判定を優先してカード化し、件数が足りない場合のみhold判定からバックフィルする
      // （exclude判定・精査未実施のクラスタは使わない）。
      // クラスタリングは似たタイトルの記事だけをまとめるため、1つのRSSフィードが
      // 話題の異なる記事を何十件も配信すると、クラスタ数（≒カード数）が記事数と
      // ほぼ同じになってしまう。情報価値スコア（lib/recommendation/scoreInformationValue.ts）を
      // 主たる並び順とし、同点の場合のみ複数ソースが同じ話題を扱っている件数・新しさで
      // タイブレークする。
      // 上限に達しなかったクラスタの元記事自体はfeed_itemsに残るため、情報は失われない。
      const topicGenreConfig = getGenreConfig(classification.understanding.primaryGenreId);
      const domainPreferenceByDomain = new Map(domainPreferences.map((d) => [d.domain, d]));
      const scoreByIndex = new Map<number, ReturnType<typeof scoreInformationValue>>();
      for (const m of clusterMeta) {
        const judgement = judgementByIndex.get(m.index)?.judgement;
        if (judgement !== "use" && judgement !== "hold") continue;
        const clusterSourceNames = [...new Set(m.cluster.map((item) => item.sourceName))];
        const signalBasedWeight = reactionSignalSummary
          ? computePreferenceWeightFromSignals(reactionSignalSummary, {
              genreId: classification.understanding.primaryGenreId,
              informationTypes: classification.understanding.informationTypes,
              sourceNames: clusterSourceNames,
            })
          : undefined;
        // research_results由来のドメイン単位嗜好（レビュー指摘#4）も、既存のジャンル/情報タイプ/
        // sourceName単位の学習と平均してuserPreferenceへ反映する。
        const clusterDomains = [...new Set(m.cluster.map((item) => item.sourceDomain).filter((d): d is string => Boolean(d)))];
        const domainWeights = clusterDomains
          .map((d) => domainPreferenceByDomain.get(d))
          .filter((d): d is (typeof domainPreferences)[number] => Boolean(d))
          .map((d) => domainPreferenceWeight(d));
        const domainBasedWeight =
          domainWeights.length > 0 ? domainWeights.reduce((a, b) => a + b, 0) / domainWeights.length : undefined;
        const baseUserPreferenceWeight =
          signalBasedWeight != null && domainBasedWeight != null
            ? (signalBasedWeight + domainBasedWeight) / 2
            : (signalBasedWeight ?? domainBasedWeight);
        scoreByIndex.set(
          m.index,
          scoreInformationValue({
            judgement,
            itemCount: m.cluster.length,
            sourceNames: clusterSourceNames,
            publishedAt: m.representative.publishedAt || null,
            todayDate: new Date().toISOString().slice(0, 10),
            channel: m.representative.channel,
            isOfficialSource: m.representative.isOfficialSource,
            hasImage: m.cluster.some((item) => item.imageUrl),
            isFollowUp: m.representative.isFollowUp,
            freshnessProfile: classification.freshnessProfile,
            locationRequired: classification.understanding.locationIntent.required,
            genreConfig: topicGenreConfig,
            baseUserPreferenceWeight,
          }),
        );
      }

      function sortEntriesByScore(entries: ClusterMetaEntry[]): ClusterMetaEntry[] {
        return [...entries].sort((a, b) => {
          const scoreA = scoreByIndex.get(a.index)?.totalScore ?? 0;
          const scoreB = scoreByIndex.get(b.index)?.totalScore ?? 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          if (b.cluster.length !== a.cluster.length) return b.cluster.length - a.cluster.length;
          const aLatest = Math.max(...a.cluster.map((item) => new Date(item.publishedAt || 0).getTime()));
          const bLatest = Math.max(...b.cluster.map((item) => new Date(item.publishedAt || 0).getTime()));
          return bLatest - aLatest;
        });
      }

      const useEntries = clusterMeta.filter((m) => judgementByIndex.get(m.index)?.judgement === "use");
      const holdEntries = clusterMeta.filter((m) => judgementByIndex.get(m.index)?.judgement === "hold");

      const sortedUseEntries = sortEntriesByScore(useEntries);
      const sortedHoldEntries = sortEntriesByScore(holdEntries);

      const entries = [...sortedUseEntries, ...sortedHoldEntries].slice(0, AI_LIMITS.maxCardsPerTopic);
      const usedHoldCount = Math.max(0, entries.length - sortedUseEntries.length);

      if (sortedUseEntries.length + sortedHoldEntries.length > entries.length) {
        result.warnings.push(
          `use判定${sortedUseEntries.length}件・hold判定${sortedHoldEntries.length}件のうち、情報価値スコア上位${entries.length}件のみカード化しました（上限${AI_LIMITS.maxCardsPerTopic}件）。`,
        );
      }
      if (usedHoldCount > 0) {
        result.warnings.push(
          `use判定のみではカード数が不足したため、hold判定から情報価値スコア上位${usedHoldCount}件を補ってカード化しました。`,
        );
      }

      // hide・click（既読/seen相当）されたのと同じ話題（dedupeKey）は、重大な更新
      // （中止・回収・締切変更・安全情報等）でない限り再生成しない（仕様書7-1）。
      const suppressedDedupeKeys = await getSuppressedDedupeKeysForTopic(topicId).catch(() => new Set<string>());
      const topicIsMajorUpdate = isMajorUpdateInformationType(classification.understanding.informationTypes);

      // high・criticalの独立ソース判定は、記事クラスタ単位ではなく「主張（同じ危険物質・
      // 症状・対応を述べているか）単位」で行う（レビュー指摘#2）。タイトル類似度だけで
      // クラスタリングされた結果、同じ主張を述べる別々の記事が別クラスタになっている
      // ケースを、主張キー（lib/recommendation-cards/hazardClaims.ts）でまとめて
      // 独立ソース数を合算できるようにする。use/hold判定のクラスタのみを対象にする。
      const claimKeyEvidence = new Map<string, ClusterableArticle[]>();
      for (const m of [...useEntries, ...holdEntries]) {
        const claimKey = extractHazardClaimKey(
          classification.understanding.primaryGenreId,
          m.representative.title,
          m.representative.summary,
        );
        if (!claimKey) continue;
        const existing = claimKeyEvidence.get(claimKey) ?? [];
        claimKeyEvidence.set(claimKey, [...existing, ...m.cluster]);
      }

      const cardInputs = [];
      let aiCardGenerationUnavailable = false;
      let suppressedDuplicateCount = 0;

      for (const entry of entries) {
        let cluster = entry.cluster;
        const representative = entry.representative;
        const clusterScore = scoreByIndex.get(entry.index) ?? null;
        const dedupeKey = computeDedupeKey(topicId, representative.title);

        if (suppressedDedupeKeys.has(dedupeKey) && !topicIsMajorUpdate) {
          suppressedDuplicateCount += 1;
          continue;
        }

        // high・criticalジャンルは、以下のいずれかを満たさない限りこのラウンドではカード化
        // しない（安全側でhold据え置き。レビュー指摘#1・#2）。
        // - 検証済みTier1（Verified Tier1: 公的機関・獣医師会・大学研究機関・topic公式等）を2件以上
        // - 検証済みTier1を1件以上 ＋ Verified professional source（Tier2相当）を1件以上
        // - 独立した運営元のVerified professional source（Tier2相当）を2件以上
        //   （実データ検証: 「ペットの中毒情報」トピックで、食品ごとの中毒情報はTier1
        //   （公的機関）がそもそも存在しにくく、専門ソース＝動物病院の記事しか見つからない
        //   ケースが大半だったため追加した組み合わせ。別々に運営されている複数の動物病院が
        //   同一の危険物質について一致した内容を発表している場合、Tier1が無くても
        //   十分に裏付けが取れていると判断する）
        // 独立ソース数は記事クラスタ単位ではなく、主張キー（同じ危険物質・症状等、
        // lib/recommendation-cards/hazardClaims.ts）が一致する他クラスタの証拠も合算して
        // 数える（同一ドメインの複数記事は1ソース扱い）。単一の動物病院記事だけで
        // 対処法を確定的にカード化する、といった事態を防ぐ。
        const clusterRiskLevel = topicGenreConfig?.defaultRiskLevel ?? "normal";
        if (requiresTier1(clusterRiskLevel)) {
          const claimKey = extractHazardClaimKey(
            classification.understanding.primaryGenreId,
            representative.title,
            representative.summary,
          );
          const mergedEvidence = claimKey ? [...cluster, ...(claimKeyEvidence.get(claimKey) ?? [])] : cluster;

          const tierByDomain = new Map<string, 1 | 2 | 3>();
          for (const item of mergedEvidence) {
            const key = item.sourceDomain ?? item.sourceName;
            if (!key) continue;
            const tier = item.sourceTier ?? 3;
            const existing = tierByDomain.get(key);
            if (!existing || tier < existing) tierByDomain.set(key, tier);
          }
          const tier1Domains = [...tierByDomain.entries()].filter(([, t]) => t === 1).map(([d]) => d);
          const tier2Domains = [...tierByDomain.entries()].filter(([, t]) => t === 2).map(([d]) => d);
          const minIndependentSources = Math.max(2, researchPlan.sourceRequirements.minimumIndependentSources);
          const totalVerifiedIndependentSources = tier1Domains.length + tier2Domains.length;
          const gatePassed =
            totalVerifiedIndependentSources >= minIndependentSources &&
            (tier1Domains.length >= 2 ||
              (tier1Domains.length >= 1 && tier2Domains.length >= 1) ||
              tier2Domains.length >= 2);

          if (!gatePassed) {
            result.warnings.push(
              `「${representative.title}」はVerified Tier1が${tier1Domains.length}件・専門ソース(Tier2)が${tier2Domains.length}件` +
                `（必要: Tier1×2、Tier1×1+専門ソース×1、または専門ソース×2のいずれか。独立ソース合計${minIndependentSources}件以上）のため、` +
                `今回はカード化を見送りました（${clusterRiskLevel}リスク）。`,
            );
            continue;
          }

          // ゲートを通過した場合、根拠となった全ソース（自クラスタ＋主張キーが一致する
          // 他クラスタ由来の証拠）をsourceUrls/sourceNames等へすべて保存できるよう、
          // クラスタ自体をマージ済みのものに差し替える（重複IDは除く）。
          if (claimKey) {
            const seenIds = new Set(cluster.map((item) => item.id));
            const additional = (claimKeyEvidence.get(claimKey) ?? []).filter((item) => !seenIds.has(item.id));
            if (additional.length > 0) cluster = [...cluster, ...additional];
          }
        }

        let generated: {
          generatedTitle: string;
          generatedSummary: string;
          displayReason: string;
          informationType: InformationType;
        };

        if (aiCardGenerationUnavailable) {
          generated = buildFallbackCardContent(representative);
          result.cardsGeneratedByFallback += 1;
        } else {
          try {
            generated = await generateRecommendationCard({
              topicName: classification.topicName,
              classification,
              researchPlan,
              articles: cluster.map((item) => ({
                title: item.title,
                summary: item.summary,
                sourceName: item.sourceName,
                sourceDomain: item.sourceDomain,
                rankingPosition: item.rankingPosition,
                origin: item.origin,
                publishedAt: item.publishedAt || null,
                url: item.url,
                isFollowUp: item.isFollowUp,
              })),
            });
          } catch (e) {
            const message = getErrorMessage(e);
            if (isAiCreditOrBillingError(e)) {
              aiCardGenerationUnavailable = true;
              result.warnings.push(
                `Anthropic APIの利用上限（クレジット残高不足等）を検知したため、以降のおすすめカードは簡易表示に切り替えます: ${message}`,
              );
            }
            generated = buildFallbackCardContent(representative);
            result.cardsGeneratedByFallback += 1;
            result.warnings.push(`おすすめカードのAI生成に失敗したため簡易表示にしました: ${message}`);
          }
        }

        // 画像候補をevaluateImages/selectCardImageでスコア化して選ぶ（仕様書7-7）。
        // 対象不一致の疑いが強い・プレースホルダー・低スコアの候補は画像なし
        // （category_default）にフォールバックする。
        const imageCandidates: ImageCandidate[] = cluster
          .filter((item) => item.imageUrl)
          .map((item) => ({
            url: item.imageUrl as string,
            channel: item.channel,
            isOfficialSource: item.sourceTier === 1,
            articleTitle: item.title,
            publishedAt: item.publishedAt || null,
            sourceImageSourceType: "article_thumbnail",
          }));
        const selectedImage = selectCardImage(imageCandidates, {
          entityName: classification.understanding.entityName,
          entityType: classification.entityType,
          topicKind: classification.understanding.topicKind,
        });

        const genreConfigForCard = getGenreConfig(classification.understanding.primaryGenreId);
        const cardRiskLevel = genreConfigForCard?.defaultRiskLevel ?? "normal";
        const freshnessLevelByProfile: Record<FreshnessProfile, string> = {
          breaking: "breaking",
          high_frequency: "today",
          daily: "recent",
          seasonal: "upcoming",
          evergreen: "evergreen",
        };

        // high・criticalカードはジャンル・informationTypeに応じた警告が必須（レビュー指摘#3）。
        // buildHighRiskWarningsは常に1件以上の警告（ジャンル固有、無ければ汎用の確認喚起文）
        // を返すため、warnings=[]でカード化されることはない。
        const cardWarnings = buildHighRiskWarnings({
          genreId: classification.understanding.primaryGenreId,
          informationTypes: classification.understanding.informationTypes,
          riskLevel: cardRiskLevel,
        });

        cardInputs.push({
          topicId,
          informationType: generated.informationType,
          generatedTitle: generated.generatedTitle,
          generatedSummary: generated.generatedSummary,
          displayReason: generated.displayReason,
          imageUrl: selectedImage.imageUrl,
          imageAlt: selectedImage.imageUrl ? generated.generatedTitle : null,
          imageSourceType: selectedImage.imageSourceType,
          imageSourceUrl: selectedImage.imageSourceUrl,
          sourceFeedItemIds: cluster
            .filter((item) => item.origin === "feed_item")
            .map((item) => item.id),
          sourceResearchResultIds: cluster
            .filter((item) => item.origin === "research_result")
            .map((item) => item.id),
          sourceUrls: cluster.map((item) => item.url),
          sourceNames: [...new Set(cluster.map((item) => item.sourceName))],
          genreId: classification.understanding.primaryGenreId,
          informationTypes: classification.understanding.informationTypes,
          crossGenreTags: classification.understanding.crossGenreTags,
          riskLevel: cardRiskLevel,
          freshnessLevel: freshnessLevelByProfile[classification.freshnessProfile],
          informationValueScore: clusterScore?.totalScore ?? null,
          scoreBreakdown: clusterScore as unknown as Record<string, number> | null,
          dedupeKey,
          entityName: classification.understanding.entityName,
          warnings: cardWarnings,
        });
      }

      if (suppressedDuplicateCount > 0) {
        result.warnings.push(
          `hide・既読済みの同一話題（${suppressedDuplicateCount}件）は、重大な更新が無いため再表示しませんでした。`,
        );
      }

      if (cardInputs.length > 0) {
        try {
          const savedCards = await createRecommendationCards(cardInputs);
          result.recommendationCardsCreated = savedCards.length;
        } catch (e) {
          result.warnings.push(`おすすめカードの保存に失敗しました: ${getErrorMessage(e)}`);
        }
      }
    } else if (result.feedItemsFetched === 0 && result.realResearchResultsForCards === 0) {
      if (mode === "mock") {
        result.warnings.push(
          "RSS記事0件・実検索結果0件のため、おすすめカードは作成されませんでした。実データで確認するには BRAVE_SEARCH_API_KEY を設定してください。",
        );
      } else {
        result.warnings.push(
          "RSS記事・検索結果のいずれも0件だったため、おすすめカードは作成されませんでした。",
        );
      }
    }

    // 6. 最終収集日時を更新
    try {
      await supabase
        .from("topics")
        .update({ last_collected_at: new Date().toISOString() })
        .eq("id", topicId)
        .eq("user_id", userId);
    } catch (e) {
      result.warnings.push(`収集日時の更新に失敗しました: ${getErrorMessage(e)}`);
    }
  } catch (e) {
    result.ok = false;
    result.error = getErrorMessage(e);
  }

  return result;
}

export async function confirmTopicRegistration(
  input: TopicInput,
  classification: TopicClassification,
  categories: GeneratedPreferenceCategory[],
): Promise<{
  topic: Topic;
  classification: TopicClassification;
  categories: TopicPreferenceCategory[];
}> {
  if (classification.identificationStatus !== "identified") {
    throw new Error("対象が特定できていないため、トピックを登録できません。");
  }

  {
    const { supabase, userId } = await getAuthedUserId();
    const rateLimit = await checkAndRecordRateLimit(
      supabase,
      userId,
      "topic_registration_confirm",
      TOPIC_CONFIRM_RATE_LIMIT_WINDOWS,
    );
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.message);
    }
  }

  const topic = await createTopic(input);

  const savedClassification = await upsertTopicClassification(
    topic.id,
    classification,
    classification,
  );
  const savedCategories = await insertTopicPreferenceCategories(topic.id, categories);

  // 収集元候補生成・AIによるリサーチ方針立案・検索実行・AI精査・カード生成までを含む
  // 自動収集パイプラインは、AI呼び出しを何度も伴い数十秒〜数分かかることがある。
  // ここで同期的に完了を待つと、登録操作そのものが長時間固まって見えてしまい、
  // 特に初めて使うユーザーほど離脱しやすい（実データ検証で確認した最重要の導線課題）。
  // そのためNext.jsのafter()を使い、レスポンスを即座に返した後にバックグラウンドで
  // 実行する。進捗はgetTopicCollectionStatus()をクライアント側からポーリングして確認する。
  after(async () => {
    try {
      await runInitialAutoCollection(topic.id, savedClassification, savedCategories);
    } catch (e) {
      // runInitialAutoCollection自体は内部で例外を吸収し結果に含める設計だが、
      // 万一ここまで例外が飛んできた場合でも、バックグラウンド実行のため
      // ユーザーへ直接は伝播できない。サーバーログに残すだけに留める。
      console.error("[confirmTopicRegistration] バックグラウンド自動収集に失敗しました", e);
    }
  });

  revalidatePath("/topics");
  revalidatePath("/sources");
  revalidatePath("/mypage");

  return {
    topic,
    classification: savedClassification,
    categories: savedCategories,
  };
}

// 登録直後の自動収集パイプライン（バックグラウンド実行）が、どこまで進んだかを
// クライアント側からポーリングして確認するための軽量な状態取得。
// AutoCollectionResultのような詳細な内訳は返さない（バックグラウンド実行のため
// 呼び出し元の関数呼び出しへ直接持ち帰れない。詳細内訳はdebug APIで別途確認できる）。
// 「完了したか」「何件カード・収集元ができたか」という、ユーザー体感に必要な
// 最小限の情報だけをDBから読み取って返す。
export interface TopicCollectionStatus {
  // topics.last_collected_atが設定されていれば収集完了とみなす
  // （runInitialAutoCollectionの最後のステップで必ず更新されるため）。
  done: boolean;
  cardsCount: number;
  sourcesCount: number;
}

export async function getTopicCollectionStatus(
  topicId: string,
): Promise<TopicCollectionStatus> {
  const { supabase, userId } = await getAuthedUserId();

  const [{ data: topicRow }, { count: cardsCount }, { count: sourcesCount }] = await Promise.all([
    supabase
      .from("topics")
      .select("last_collected_at")
      .eq("id", topicId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("recommendation_cards")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId)
      .eq("user_id", userId),
    supabase
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", topicId)
      .eq("user_id", userId),
  ]);

  return {
    done: !!topicRow?.last_collected_at,
    cardsCount: cardsCount ?? 0,
    sourcesCount: sourcesCount ?? 0,
  };
}
