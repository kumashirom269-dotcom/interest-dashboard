import Anthropic from "@anthropic-ai/sdk";
import {
  RESEARCH_CHANNELS,
  type ResearchCandidateBudget,
  type ResearchChannel,
  type ResearchExpansionPolicy,
  type ResearchFreshnessPolicy,
  type ResearchPlan,
  type ResearchSourcePriority,
  type ResearchSourceRequirements,
} from "@/lib/research/types";
import {
  INFORMATION_NEEDS,
  type InformationNeed,
  type TopicClassification,
} from "@/lib/topic-classification/types";
import { PREFERENCE_CATEGORY_TYPE_LABELS } from "@/lib/topic-preferences/types";
import type { TopicPreferenceCategory } from "@/lib/topic-preferences/types";
import { getGenreConfig } from "@/lib/genres/genreConfigs";
import type { GenreDetailedConfig } from "@/lib/genres/types";
import { AI_LIMITS } from "@/lib/config/aiLimits";
import { parseAiJsonSafely } from "./parseAiJsonSafely";

const client = new Anthropic();

// GenreDetailedConfig.sourceLayers/officialVerificationRequired/minimumIndependentSourcesから
// sourceRequirementsを決定的に導出する（AIには生成させない。ジャンル設定は既に確定仕様のため）。
function buildSourceRequirements(genreConfig: GenreDetailedConfig | undefined): ResearchSourceRequirements {
  return {
    requiredTier1Categories: genreConfig?.sourceLayers.tier1.sourceCategories ?? [],
    preferredTier2Categories: genreConfig?.sourceLayers.tier2.sourceCategories ?? [],
    optionalTier3Categories: genreConfig?.sourceLayers.tier3.sourceCategories ?? [],
    blockedSourceCategories: [],
    prohibitedTier3Uses: genreConfig?.sourceLayers.tier3.prohibitedUses ?? [],
    officialVerificationRequired: genreConfig?.officialVerificationRequired ?? false,
    minimumIndependentSources: genreConfig?.minimumIndependentSources ?? 1,
  };
}

// AI_LIMITS（API節約モードを含む）を超えない範囲で、1トピックあたりの収集件数上限を決める。
function buildCandidateBudget(): ResearchCandidateBudget {
  return {
    maxCollectedCandidates: AI_LIMITS.maxResearchResultsPerTopic,
    maxCandidatesPerSource: Math.max(1, Math.round(AI_LIMITS.maxResearchResultsPerTopic / 5)),
    maxCandidatesPerInformationType: Math.max(1, Math.round(AI_LIMITS.maxResearchResultsPerTopic / 4)),
    targetCardCount: AI_LIMITS.maxCardsPerTopic,
  };
}

// generateResearchPlan・buildFallbackResearchPlanの時点では、探索範囲拡張が
// 必要かどうかまだ判断できない（初期収集結果を見ないと分からないため）。
// 常に無効な状態で初期化し、実際に必要かどうかはactions.tsが
// evaluateResearchCoverageの結果を踏まえてルールベースで判断する（追加のAI呼び出しなし）。
export const DEFAULT_EXPANSION_POLICY: ResearchExpansionPolicy = {
  enabled: false,
  trigger: "none",
  expandedInformationNeeds: [],
  expansionQueries: [],
  explanation: "",
};

export interface GenerateResearchPlanInput {
  topicId: string;
  topicName: string;
  classification: TopicClassification;
  // ユーザーが選択した「集めたい情報カテゴリ」。渡された場合、選択済みカテゴリを
  // 優先しつつ、話題性が高そうな未選択カテゴリのクエリも少数含めるようプロンプトで促す。
  categories?: TopicPreferenceCategory[];
  // リアクション学習（lib/reactions/loadReactionSignalSummary.ts）から算出した、
  // このジャンル・情報タイプに対する過去の嗜好スコア（0〜100、50が中立）。
  // 渡された場合、好まれている情報タイプを優先するようプロンプトで促す。
  preferredInformationTypeWeight?: number;
  // 現在日付（YYYY-MM-DD、Asia/Tokyo基準）。省略時は呼び出し時点のサーバー時刻から算出する。
  // AIが学習データのカットオフ年（例:2024年）をそのまま検索クエリに使ってしまう問題への
  // 対策として、プロンプトに明示し、かつ生成後に決定的ロジックで過去年を補正する。
  currentDate?: string;
  timezone?: string;
  // research_results由来カードのリアクションから集計したドメイン単位の嗜好
  // （lib/source-domain-preferences/queries.ts、レビュー指摘#4）。過去に高評価・低評価だった
  // 収集元ドメインをsourceHints・除外傾向としてプロンプトに反映する。
  preferredDomains?: string[];
  avoidedDomains?: string[];
}

function defaultCurrentDateParts(timezone: string): { currentDate: string; currentYear: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const currentDate = formatter.format(new Date());
  const currentYear = Number(currentDate.slice(0, 4));
  return { currentDate, currentYear };
}

// AIが生成した検索クエリ中の西暦を、historical intent（過去の情報を許容する）でない限り
// 現在年以降に決定的ロジックで補正する。学習データのカットオフ年をそのまま使ってしまい、
// 現在は存在しない年度のクエリで検索してしまう不具合への対策。
const YEAR_PATTERN = /\b(20\d{2})\b/g;

export function correctPastYearsInQueries(
  queries: string[],
  currentYear: number,
  allowHistorical: boolean,
): string[] {
  if (allowHistorical) return queries;
  return queries.map((q) =>
    q.replace(YEAR_PATTERN, (match) => {
      const year = Number(match);
      return year < currentYear ? String(currentYear) : match;
    }),
  );
}

// TopicUnderstandingは「トピックが何なのか・何を求めているか」を理解する段階、
// ResearchPlanはそれを踏まえて「実際にどこから・何を探すべきか」という
// リサーチ方針そのものをAIに立てさせる段階。
// RSS・Brave検索はここでは数ある収集チャネルの一部として扱い、公式サイト直接クロール・
// ニュースサイト・イベント/チケットサイト・地域メディア等も対等な選択肢として提示する
// （実装済みのチャネルはofficial_site・brave_search・rssのみだが、型・プロンプト上は
// 将来のチャネル追加に備えて全チャネルから選ばせる）。
const SYSTEM_PROMPT = `あなたは、ユーザーの関心トピックについて「どこから・何を・どのように探すべきか」という
リサーチ方針（ResearchPlan）を立てるリサーチプランナーです。

このサービスは、RSSフィードやBrave検索APIの結果をそのまま並べるのではなく、トピックの性質に応じて
最適な情報源の種類・検索クエリ・除外条件を判断し、複数チャネルを組み合わせて情報収集する構造を
目指しています。以下を守ってください。

- 最も重視すべきは userIntentSummary（ユーザーが本当に求めている情報）です。primaryGoalには、
  このトピックのリサーチで最終的に何を明らかにしたいのかを一文で書く
- topicKind（トピックの種別）に応じて、収集チャネル・クエリの重視ポイントを変える
  - entity_topic（1つの固有対象）: 公式サイト・ニュース・イベント・チケット・公式SNS・専門メディア
  - theme_topic（横断的テーマ）: 特集記事・ニュース・専門サイト・まとめ記事・SNSトレンド・比較解説記事
  - seasonal_topic（季節型）: 季節情報・カレンダー系サイト・専門サイト・地域情報・小売/市場/食品ニュース。
    searchQueriesには「今が旬の」「7月 旬の」のような、現在の季節・時期を意識したクエリを含める
  - local_discovery_topic（地域探索型）: 地域メディア・自治体・店舗公式・イベントサイトを優先する
    （official_site・local_mediaを積極的に含める）
  - recommendation_topic（おすすめ・比較型）: 比較サイト・レビュー・ランキング・価格/セール・専門メディア
  - trend_topic（トレンド型）: SNSトレンド・news_site・social_or_video
  - learning_topic（学習型）: documentation（公式ドキュメント）・入門記事・教材・学習ロードマップ・
    Q&A解説記事を優先する。audienceLevelがbeginnerの場合は特に入門・ロードマップ系を重視する
- preferredChannelsは、このトピックにとって有効な収集チャネルを選ぶ（複数可）。RSS・Brave検索に
  限定せず、トピックの性質に応じて選ぶこと
  - 公式性が重要なトピック（企業・製品・公式発表を求める場合）→ official_site を含める
  - イベント・ライブ・公演等 → event_site・ticket_site・official_site
  - 地域の店舗・施設・自治体情報 → local_media・official_site
  - 学習・技術情報 → documentation・general_web
  - アーティスト・タレント等 → official_site・social_or_video・news_site
  - 一般的なニュース・話題 → news_site・brave_search・rss
  - 上記に関わらず、既存の登録済み情報源（RSS）が有効な場合は rss も含めてよい
- searchQueriesは一般的な検索クエリ（Brave検索等で使う）。officialSiteQueriesは公式サイト内で
  探すべき内容やそのものの検索語、eventQueriesは日程・会場・チケット等イベント関連に特化した検索語
  （該当しないトピックでは空配列でよい）
- exclusionQueriesは「これに引っかかったら誤検出の可能性が高い」検索語（実行はしないが、精査の
  参考にする）
- mustIncludeSignalsは含まれていてほしい語句、mustExcludeSignalsはnegativeSignalsを踏まえた
  除外すべき語句
- sourcePriorityは各情報源カテゴリ（official/news/local/social/blog/search/rss）の優先度を
  0〜100の整数で表す。official_siteが有効なトピックはofficialを高くする等、preferredChannelsと
  整合させる
- freshnessPolicyは、timeIntentとfreshnessProfileを踏まえて判断する。allowHistoricalは過去の
  情報を許容してよいか、preferFutureは今後の予定を優先すべきか、maxAgeDaysは古さの目安の日数
  （制限がなければnull）、explanationは判断理由
- expectedResultTypesは、informationNeedsを踏まえてこのリサーチで得たい情報の種類を選ぶ
- notesForVettingは、後続の精査ステップ（記事を使う/保留/除外を判定する）に向けた補足メモを書く
- トピック名の単語をそのまま検索するのではなく、userIntentSummaryとentityNameに沿った具体的な
  クエリにする。トピックが複数メンバーで構成される場合、全体クエリだけでなくメンバー個別のクエリも
  検討する
- ambiguity.isAmbiguousがtrueの場合、最も可能性の高い意味に絞ったクエリ・除外語にする
- 「33ジャンル分類」として渡されるジャンル別の収集方針（情報源方針・情報タイプ優先度・鮮度ルール）が
  補足情報にある場合、それをpreferredChannels・searchQueries・sourcePriority・freshnessPolicyへ
  必ず反映すること（topicKind別の方針と矛盾する場合はtopicKindを優先しつつ、両方を満たすよう調整する）
- 「過去の嗜好スコア」が補足情報にある場合、50より高ければそのジャンル・情報タイプの収集を
  やや積極的にし、50より低ければ比重を下げる（ただしhigh/criticalリスクの安全情報を
  除外・軽視してはいけない）
- 必ずJSONのみを返す。日本語で生成する（識別子系の値は指定の識別子を使う）

preferredChannelsの候補: ${RESEARCH_CHANNELS.join(", ")}
expectedResultTypesの候補: ${INFORMATION_NEEDS.join(", ")}`;

function buildUserMessage(input: GenerateResearchPlanInput): string {
  const c = input.classification;
  const u = c.understanding;
  const timezone = input.timezone ?? "Asia/Tokyo";
  const { currentDate, currentYear } = input.currentDate
    ? { currentDate: input.currentDate, currentYear: Number(input.currentDate.slice(0, 4)) }
    : defaultCurrentDateParts(timezone);
  const lines = [
    `現在日付: ${currentDate}（タイムゾーン: ${timezone}）。現在年: ${currentYear}年。検索クエリに西暦を` +
      `含める場合、historical intent（過去の情報を求めている）でない限り、必ず${currentYear}年以降の年を使うこと。` +
      `学習データのカットオフ年をそのまま使わないこと`,
    `トピック名: ${input.topicName}`,
    `topicKind（トピック種別、必ず考慮すること）: ${u.topicKind}`,
    `entityType: ${c.entityType}`,
    `分類: ${c.parentCategory} / ${c.subCategory} / ${c.detailCategory}`,
    `概要: ${c.summary}`,
    `鮮度プロファイル: ${c.freshnessProfile}（${c.freshnessReason}）`,
    `時期の意図: ${c.timeIntent}（${c.timeIntentReason}）`,
    `ユーザーの意図（最重要）: ${u.userIntentSummary}`,
    `対象エンティティ: ${u.entityName ?? "(特定の対象なし)"}${u.entityType ? `（${u.entityType}）` : ""}`,
    `トピックカテゴリ: ${u.category}`,
    `求めている情報の種類: ${u.informationNeeds.join(", ") || "(指定なし)"}`,
    `優先すべき観点（prioritySignals）: ${u.prioritySignals.join(", ") || "(なし)"}`,
    `避けるべき方向性（negativeSignals）: ${u.negativeSignals.join(", ") || "(なし)"}`,
    `想定される検索語のヒント（searchHints）: ${u.searchHints.join(", ") || "(なし)"}`,
    `向いている情報源（sourceHints）: ${u.sourceHints.join(", ") || "(なし)"}`,
    `対象読者レベル: ${u.audienceLevel}`,
  ];

  const genreConfig = getGenreConfig(u.primaryGenreId);
  if (genreConfig) {
    lines.push(
      `33ジャンル分類: ${genreConfig.displayName}${u.secondaryGenreIds.length > 0 ? `（関連: ${u.secondaryGenreIds.map((id) => getGenreConfig(id)?.displayName ?? id).join("、")}）` : ""}`,
      `ジャンル別収集方針 - 第1層(公式・一次情報): ${genreConfig.sourceLayers.tier1.exampleSources.join("、")}`,
      `ジャンル別収集方針 - 第2層(専門メディア): ${genreConfig.sourceLayers.tier2.exampleSources.join("、")}`,
      `ジャンル別収集方針 - 第3層(補完プラットフォーム): ${genreConfig.sourceLayers.tier3.exampleSources.join("、")}`,
      `ジャンル別優先情報タイプ: ${genreConfig.informationTypePriorities.join(", ") || "(指定なし)"}`,
      `ジャンル別安全・品質ルール: ${genreConfig.qualityAndSafetyRules.join(" / ")}`,
    );
  }
  if (u.informationTypes.length > 0) {
    lines.push(`このトピックの情報タイプ: ${u.informationTypes.join(", ")}`);
  }
  if (u.crossGenreTags.length > 0) {
    lines.push(`横断タグ: ${u.crossGenreTags.join(", ")}`);
  }
  if (input.preferredInformationTypeWeight != null) {
    lines.push(`過去の嗜好スコア（0〜100、50が中立）: ${Math.round(input.preferredInformationTypeWeight)}`);
  }
  if (input.preferredDomains && input.preferredDomains.length > 0) {
    lines.push(
      `過去に高評価だった収集元ドメイン（sourceHintsやofficialSiteQueries等で優先的に検討してよい）: ${input.preferredDomains.join(", ")}`,
    );
  }
  if (input.avoidedDomains && input.avoidedDomains.length > 0) {
    lines.push(
      `過去に低評価（bad/hide）だった収集元ドメイン（安全性に関わらない範囲で優先度を下げてよい。exclusionQueriesの参考にもしてよい）: ${input.avoidedDomains.join(", ")}`,
    );
  }

  if (u.locationIntent.required) {
    lines.push(`地域性: あり（${u.locationIntent.locationText ?? "地域指定不明"}）`);
  }

  if (u.ambiguity.isAmbiguous) {
    lines.push(
      `曖昧性: このトピック名には複数の意味があり得る（${u.ambiguity.candidateMeanings.join(" / ")}）。理由: ${u.ambiguity.reason ?? "不明"}。` +
        `${u.entityName ?? input.topicName}としての意味に絞ってリサーチ方針を立てること`,
    );
  }

  if (input.categories && input.categories.length > 0) {
    const selected = input.categories.filter((c) => c.isSelected);
    const unselected = input.categories.filter((c) => !c.isSelected);
    lines.push(
      `ユーザーが選択した収集カテゴリ: ${selected.map((c) => `${c.label}（${PREFERENCE_CATEGORY_TYPE_LABELS[c.categoryType]}）`).join(", ") || "(なし)"}`,
    );
    if (unselected.length > 0) {
      lines.push(
        `ユーザーが選択しなかったカテゴリ（話題性が高ければ拾ってよい）: ${unselected.map((c) => c.label).join(", ")}`,
      );
    }
  }

  return lines.join("\n");
}

interface RawResearchPlan {
  primaryGoal: string;
  preferredChannels: string[];
  searchQueries: string[];
  officialSiteQueries: string[];
  eventQueries: string[];
  exclusionQueries: string[];
  mustIncludeSignals: string[];
  mustExcludeSignals: string[];
  sourcePriority: {
    official: number;
    news: number;
    local: number;
    social: number;
    blog: number;
    search: number;
    rss: number;
  };
  freshnessPolicy: {
    allowHistorical: boolean;
    preferFuture: boolean;
    maxAgeDays: number | null;
    explanation: string;
  };
  expectedResultTypes: string[];
  notesForVetting: string;
}

function normalizeChannels(values: string[]): ResearchChannel[] {
  const valid = values.filter((v): v is ResearchChannel =>
    (RESEARCH_CHANNELS as string[]).includes(v),
  );
  return valid.length > 0 ? valid : ["brave_search", "rss"];
}

function normalizeInformationNeeds(values: string[]): InformationNeed[] {
  return values.filter((v): v is InformationNeed =>
    (INFORMATION_NEEDS as string[]).includes(v),
  );
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizeSourcePriority(raw: RawResearchPlan["sourcePriority"]): ResearchSourcePriority {
  return {
    official: clampScore(raw?.official ?? 0),
    news: clampScore(raw?.news ?? 0),
    local: clampScore(raw?.local ?? 0),
    social: clampScore(raw?.social ?? 0),
    blog: clampScore(raw?.blog ?? 0),
    search: clampScore(raw?.search ?? 0),
    rss: clampScore(raw?.rss ?? 0),
  };
}

function normalizeFreshnessPolicy(
  raw: RawResearchPlan["freshnessPolicy"],
): ResearchFreshnessPolicy {
  return {
    allowHistorical: Boolean(raw?.allowHistorical),
    preferFuture: Boolean(raw?.preferFuture),
    maxAgeDays:
      typeof raw?.maxAgeDays === "number" && Number.isFinite(raw.maxAgeDays)
        ? Math.max(0, Math.round(raw.maxAgeDays))
        : null,
    explanation: raw?.explanation ?? "",
  };
}

// フォールバック用の最低限のResearchPlan。AI呼び出し自体が失敗した場合でも
// 自動収集パイプライン全体を止めないよう、既存のsearchHints等から機械的に組み立てる
// （呼び出し元がtry/catchでこの関数の失敗を吸収する設計だが、念のためexportしておく）。
export function buildFallbackResearchPlan(input: GenerateResearchPlanInput): ResearchPlan {
  const u = input.classification.understanding;
  const genreConfig = getGenreConfig(u.primaryGenreId);
  return {
    topicId: input.topicId,
    topicName: input.topicName,
    userIntentSummary: u.userIntentSummary,
    primaryGoal: u.userIntentSummary || `${input.topicName}に関する情報を探す`,
    preferredChannels: ["brave_search", "rss"],
    searchQueries: u.searchHints.length > 0 ? u.searchHints : [input.topicName],
    officialSiteQueries: [],
    eventQueries: [],
    exclusionQueries: [],
    mustIncludeSignals: u.prioritySignals,
    mustExcludeSignals: u.negativeSignals,
    sourcePriority: { official: 50, news: 50, local: 30, social: 30, blog: 30, search: 60, rss: 50 },
    freshnessPolicy: {
      allowHistorical: input.classification.timeIntent === "historical",
      preferFuture:
        input.classification.timeIntent === "current_or_future" ||
        input.classification.timeIntent === "recent",
      maxAgeDays: null,
      explanation: "AIによるプラン生成に失敗したためフォールバックの方針を使用",
    },
    expectedResultTypes: u.informationNeeds,
    notesForVetting: u.userIntentSummary,
    expansionPolicy: DEFAULT_EXPANSION_POLICY,
    primaryGenreId: u.primaryGenreId,
    informationTypes: u.informationTypes,
    sourceRequirements: buildSourceRequirements(genreConfig),
    candidateBudget: buildCandidateBudget(),
    preferredCardTypes: genreConfig?.preferredCardTypes ?? [],
    safetyConstraints: genreConfig?.qualityAndSafetyRules ?? [],
  };
}

export async function generateResearchPlan(
  input: GenerateResearchPlanInput,
): Promise<ResearchPlan> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            primaryGoal: { type: "string" },
            preferredChannels: {
              type: "array",
              items: { type: "string", enum: RESEARCH_CHANNELS },
            },
            searchQueries: { type: "array", items: { type: "string" } },
            officialSiteQueries: { type: "array", items: { type: "string" } },
            eventQueries: { type: "array", items: { type: "string" } },
            exclusionQueries: { type: "array", items: { type: "string" } },
            mustIncludeSignals: { type: "array", items: { type: "string" } },
            mustExcludeSignals: { type: "array", items: { type: "string" } },
            sourcePriority: {
              type: "object",
              properties: {
                official: { type: "integer" },
                news: { type: "integer" },
                local: { type: "integer" },
                social: { type: "integer" },
                blog: { type: "integer" },
                search: { type: "integer" },
                rss: { type: "integer" },
              },
              required: ["official", "news", "local", "social", "blog", "search", "rss"],
              additionalProperties: false,
            },
            freshnessPolicy: {
              type: "object",
              properties: {
                allowHistorical: { type: "boolean" },
                preferFuture: { type: "boolean" },
                maxAgeDays: { type: ["integer", "null"] },
                explanation: { type: "string" },
              },
              required: ["allowHistorical", "preferFuture", "maxAgeDays", "explanation"],
              additionalProperties: false,
            },
            expectedResultTypes: {
              type: "array",
              items: { type: "string", enum: INFORMATION_NEEDS },
            },
            notesForVetting: { type: "string" },
          },
          required: [
            "primaryGoal",
            "preferredChannels",
            "searchQueries",
            "officialSiteQueries",
            "eventQueries",
            "exclusionQueries",
            "mustIncludeSignals",
            "mustExcludeSignals",
            "sourcePriority",
            "freshnessPolicy",
            "expectedResultTypes",
            "notesForVetting",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AIがリサーチ方針の生成を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  const parseResult = parseAiJsonSafely<RawResearchPlan>(textBlock.text);
  if (!parseResult.ok) {
    throw new Error(
      `AIの応答（リサーチ方針）のJSON解析に失敗しました: ${parseResult.errorMessage} / 応答: ${parseResult.responsePreview}`,
    );
  }
  const parsed = parseResult.data;
  const u = input.classification.understanding;
  const genreConfig = getGenreConfig(u.primaryGenreId);
  const freshnessPolicy = normalizeFreshnessPolicy(parsed.freshnessPolicy);
  const { currentYear } = input.currentDate
    ? { currentYear: Number(input.currentDate.slice(0, 4)) }
    : defaultCurrentDateParts(input.timezone ?? "Asia/Tokyo");

  return {
    topicId: input.topicId,
    topicName: input.topicName,
    userIntentSummary: u.userIntentSummary,
    primaryGoal: parsed.primaryGoal,
    preferredChannels: normalizeChannels(parsed.preferredChannels ?? []),
    searchQueries: correctPastYearsInQueries(parsed.searchQueries ?? [], currentYear, freshnessPolicy.allowHistorical),
    officialSiteQueries: correctPastYearsInQueries(
      parsed.officialSiteQueries ?? [],
      currentYear,
      freshnessPolicy.allowHistorical,
    ),
    eventQueries: correctPastYearsInQueries(parsed.eventQueries ?? [], currentYear, freshnessPolicy.allowHistorical),
    exclusionQueries: parsed.exclusionQueries ?? [],
    mustIncludeSignals: parsed.mustIncludeSignals ?? [],
    mustExcludeSignals: parsed.mustExcludeSignals ?? [],
    sourcePriority: normalizeSourcePriority(parsed.sourcePriority),
    freshnessPolicy,
    expectedResultTypes: normalizeInformationNeeds(parsed.expectedResultTypes ?? []),
    notesForVetting: parsed.notesForVetting ?? "",
    expansionPolicy: DEFAULT_EXPANSION_POLICY,
    primaryGenreId: u.primaryGenreId,
    informationTypes: u.informationTypes,
    sourceRequirements: buildSourceRequirements(genreConfig),
    candidateBudget: buildCandidateBudget(),
    preferredCardTypes: genreConfig?.preferredCardTypes ?? [],
    safetyConstraints: genreConfig?.qualityAndSafetyRules ?? [],
  };
}
