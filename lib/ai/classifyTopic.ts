import Anthropic from "@anthropic-ai/sdk";
import {
  AUDIENCE_LEVELS,
  FRESHNESS_PROFILES,
  FRESHNESS_PROFILE_DEFAULTS,
  TIME_INTENTS,
  TOPIC_ENTITY_TYPES,
  type AudienceLevel,
  type FreshnessProfile,
  type TimeIntent,
  type TopicCandidateEntity,
  type TopicClassification,
  type TopicEntityType,
  type TopicUnderstanding,
} from "@/lib/topic-classification/types";
import { TOPIC_KINDS, type TopicKind } from "@/lib/topic-identification/types";
import type { SourceType } from "@/types/domain";
import { GENRE_DEFINITIONS, isValidGenreId } from "@/lib/genres/definitions";
import { deriveLegacyCategoryFields } from "@/lib/genres/genreConfigs";
import { INFORMATION_TYPES, isValidInformationType } from "@/lib/genres/informationTypes";
import { findApplicableCrossGenreRules } from "@/lib/genres/crossGenreRules";
import { parseAiJsonSafely } from "./parseAiJsonSafely";

const SOURCE_TYPES: SourceType[] = [
  "official_blog",
  "news_site",
  "rss",
  "tech_blog",
  "local_event_site",
  "youtube_channel",
  "research_site",
  "other",
];

const client = new Anthropic();

const SYSTEM_PROMPT = `あなたは、ユーザーが登録した自由入力のトピック名を分類するアシスタントです。
ユーザーが登録するトピックは、芸能人・グループ・場所・技術・作品・企業・商品・地域情報・生活テーマ・ニューステーマなど多岐にわたり、
事前にすべてのカテゴリを用意することはできません。そのため、トピック名だけを手がかりに、以下の観点で分類してください。

- この単語は人物、グループ、場所、技術、作品、企業、商品、地域情報、生活テーマ、ニューステーマのどれに近いか
- ユーザーがこのトピックで追跡したい情報は何か（新曲、ライブ、出演情報、アップデート、イベントなど）
- どのような情報源が向いているか（公式サイト、ニュース、RSS、YouTube、技術ブログ、地域イベントサイト、研究サイトなど）
- 収集元候補生成やRSS探索に使える検索キーワードは何か

トピック名は、同姓同名の人物・あだ名や芸名だけの登録・グループ名と作品名の類似・
範囲が広すぎる技術用語や大きすぎるテーマ・地域名とジャンルが混ざった入力・
文脈がないと意味が定まらない固有名詞（AIサービス名か人名かなど）など、
一意に定まらないことがあります。無理に1つに決め打ちせず、必要な場合は複数の解釈候補を示してください。

必ず以下を守ってください。
- 必ずJSONのみを返す（説明文やコードブロックの記法は不要）
- 分類はすべて日本語で行う（entityType・recommendedSourceTypesの値自体は指定の英語識別子を使う）
- topicNameには渡された入力をそのまま使う
- entityTypeは指定された候補から1つだけ選ぶ。判断に迷う場合はunknownにする
- intentTagsは、そのトピックでユーザーが追跡したそうな情報の種類を3〜6個
- recommendedSourceTypesは、指定されたsource_typeの候補からこのトピックに向いているものを1〜5個選ぶ
- searchKeywordsは、収集元候補生成やRSS探索で使える検索語を3〜6個
- confidenceは0〜1の数値（自信の度合い）
- confidenceが低い場合や、entityTypeがunknownの場合は、needsUserConfirmationをtrueにする
- トピック名が曖昧で複数の解釈が考えられる場合は、needsUserConfirmationをtrueにし、
  candidateEntitiesに2〜5件の解釈候補を出す。それぞれにlabel（候補の名前）・entityType・
  parentCategory・subCategory・description（この候補を選ぶとどう扱うか）・confidence（0〜1）を入れる
- 曖昧でない場合、candidateEntitiesは空配列にする
- needsUserConfirmationをtrueにした場合は、ambiguityReasonになぜ確認が必要かを書く
- researchHintsには、将来Web検索やSNS検索で調査する場合に確認すべき観点を1〜4個入れる
  （例: 「公式サイトの有無を確認」「同姓同名の別人物がいないか確認」など）。曖昧でない場合も、
  今後の情報収集で確認すると役立つ観点があれば入れてよい
- 実在確認が必要そうな新語・人名・固有名詞（最近デビューした芸能人、新しいサービス名など）で、
  情報が不足していて自信を持てない場合は、notesに「Web調査が望ましい」という文言を含めて理由を書く
- 判断に迷う場合や情報が乏しい場合は、無理に断定せずconfidenceを低くする
- 「補足情報」が渡されている場合、それはユーザーが対象特定ゲートで既に候補選択・URL入力・
  追加説明によって対象を確定させた後の情報です。トピック名単体では曖昧に見えても、
  補足情報に書かれた対象を前提にして分類してください。この場合は無理に確認を求めず、
  needsUserConfirmationは必ずfalseにし、candidateEntitiesは空配列にしてください。

さらに、このトピックの情報がどれくらいの頻度で更新価値を持つか（freshnessProfile）も判定してください。
- breaking: 災害・地震・台風・交通障害・緊急ニュースなど、数分〜数十分単位で情報が変わるもの
- high_frequency: 芸能ニュース・スポーツ速報・株価・為替・選挙速報・SNSトレンドなど、数十分〜数時間単位のもの
- daily: アーティスト・YouTuber・芸能人・技術ニュース・一般ニュースなど、日次程度の確認で十分なもの
- seasonal: 夏のイベント・花火大会・地域イベント・期間限定キャンペーンなど、開催期間中だけ価値があるもの
- evergreen: プログラミング学習・趣味・知識系・レビュー・ノウハウなど、長期間価値が変わらないもの
freshnessReasonには、なぜそのプロファイルを選んだかを一言で書いてください。

さらに、ユーザーがこのトピックで「過去・現在・未来のどの時期の情報」を求めているか（timeIntent）も
判定してください。これは、情報収集時に「古い情報を除外してよいか」を判断する材料になります。
- current_or_future: 通常のトピック名（例:「THE ALFEE」「嵐」）。特に時期の指定がない場合はこれにする。
  現在〜近い未来の情報を優先し、数か月前の古い情報は基本的に優先度を下げてよい
- recent: 「最近の」「近況」のように直近の話題を明示的に求めているもの
- historical: 「〇〇の過去」「〇〇の歴史」「1980年代の〇〇」のように、明示的に過去の情報を
  求めているもの。この場合、古い情報を除外してはいけない
- specific_period: 「〇〇 2026年ライブ」のように特定の時期・イベントを指しているもの
- evergreen: 学習・ノウハウ・レビューなど、そもそも情報の新しさが重要でないもの
timeIntentReasonには、なぜそのtimeIntentを選んだかを一言で書いてください。
迷った場合は必ずcurrent_or_futureにしてください（古い情報を誤って許可してしまうより、
新しい情報を優先する方が一般的なユーザーの期待に近いため）。

さらに、understandingとして「トピックの情報ニーズの中身」を構造化してください。
これは、ユーザーが入力した文字列をそのまま検索キーワードとして扱うのではなく、
「何についての話か」「どんな情報を求めているか」をAIが理解した結果です。

- topicKind: このトピックの種別。entity_topic（1つの固有対象を追う）、theme_topic
  （固有対象ではない横断的なテーマ）、seasonal_topic（季節・時期で内容が変わる）、
  local_discovery_topic（地域内の新しいもの・イベント探索）、recommendation_topic
  （おすすめ・比較・選び方）、trend_topic（流行・SNS・話題性）、learning_topic
  （学習・入門・勉強方法）から1つ選ぶ。「補足情報」に対象特定ゲートで確定した
  topicKindが書かれている場合は、必ずその値をそのまま使うこと（自分で判断し直さない）
- normalizedTopic: 対象と情報ニーズが分かる、整理された言い方（例:「嵐のイベント情報」）
- entityName: 対象そのものの名前（例:「嵐」「THE ALFEE」）。対象が特定の固有名詞でない
  場合（例:「初心者向けのJava学習」）はnullにする
- entityType: 対象の種類を短い説明的なラベルで（例:"artist_group", "restaurant_category",
  "programming_language"）。無理に既存の分類に当てはめず、自由に短く表現してよい。不明ならnull
- primaryGenreId: このトピックが属する33ジャンルのうち、最も中心的な1つ。
  candidatesから1つだけ選ぶ（迷う場合も必ず最も近いものを1つ選ぶこと。nullや空文字は不可）
- secondaryGenreIds: 強く関連する追加ジャンルを最大2件（無ければ空配列）。primaryGenreIdと
  重複させない
- auxiliaryGenreIds: 弱く関連する補助ジャンルを必要に応じて（無ければ空配列）
- informationTypes: このトピックで収集すべきジャンル横断の情報タイプを1〜6個。
  candidatesから選ぶ（例:「旬な果物」→ harvest_start, seasonal_limited）
- crossGenreTags: 健康・医療、暮らし・住まい、家族・子育て、お酒・嗜好飲料、金融・法律・制度、
  災害・安全、求人・募集・申請、商品回収・注意喚起など、独立ジャンルではない横断領域に
  該当する場合、その領域を表す短い英語タグを0〜4個（例:"family_childcare", "seasonal_food"）。
  該当しない場合は空配列
- prioritySignals: 情報を選ぶ際に優先すべき具体的な語句・観点を3〜8個
  （例:「開催予定」「イベント」「チケット」「出演」「公式発表」）
- negativeSignals: 除外すべき方向性を2〜6個（例:「過去の一般ニュース」「ゴシップ」
  「無関係な同名の別対象」「トピック名が一般語と同じ場合はその一般語としての意味」）
- searchHints: 検索APIに投げる際に使える具体的な補助キーワードを3〜8個
  （トピック名＋観点の組み合わせ。例:「嵐 イベント」「嵐 チケット」「嵐 公式」）
- sourceHints: この情報を探すのに向いている情報源の種類を1〜4個（例:「公式サイト」
  「チケットサイト」「音楽ニュース」「地域情報サイト」）
- audienceLevel: 想定される読み手のレベル。学習系トピックで特に重要（例:「初心者向けJava学習」→beginner）。
  該当しない場合はunknown
- locationIntent.required: 地域性が必要なトピックかどうか（例:「高崎市の飲食店」→true）
- locationIntent.locationText: 地域が指定されている場合はその地名。なければnull
- ambiguity.isAmbiguous: トピック名が一般語・同名の別対象と紛らわしいか
  （例:「嵐」は天候の意味もある、という場合はtrue）
- ambiguity.reason: isAmbiguousがtrueの場合、なぜ紛らわしいかを一言で
- ambiguity.candidateMeanings: 考えられる意味の候補を2〜4個（例:「アーティストグループの嵐」
  「気象現象としての嵐」）。isAmbiguousがfalseの場合は空配列
- userIntentSummary: 「ユーザーは〇〇について、△△のような情報を求めている」という形の、
  1〜2文の要約。以後の検索・精査・カード生成で最も重要な参照情報になるため、具体的に書く

understandingを作る際は、迷った場合はユーザーに出す情報が広がりすぎないよう安全側
（対象を絞る・prioritySignalsを具体的にする）に倒してください。

entityTypeの候補: ${TOPIC_ENTITY_TYPES.join(", ")}
understanding.primaryGenreId / secondaryGenreIds / auxiliaryGenreIdsの候補（genreId: 表示名）:
${GENRE_DEFINITIONS.map((g) => `${g.genreId}: ${g.displayName}`).join(", ")}
understanding.informationTypesの候補: ${INFORMATION_TYPES.join(", ")}
source_typeの候補: ${SOURCE_TYPES.join(", ")}
freshnessProfileの候補: ${FRESHNESS_PROFILES.join(", ")}
timeIntentの候補: ${TIME_INTENTS.join(", ")}
understanding.topicKindの候補: ${TOPIC_KINDS.filter((k) => k !== "ambiguous_topic" && k !== "unknown").join(", ")}
understanding.audienceLevelの候補: ${AUDIENCE_LEVELS.join(", ")}`;

interface RawCandidateEntity {
  label: string;
  entityType: string;
  parentCategory: string;
  subCategory: string;
  detailCategory?: string;
  description: string;
  confidence: number;
}

interface RawTopicClassification {
  topicName: string;
  entityType: string;
  summary: string;
  intentTags: string[];
  recommendedSourceTypes: string[];
  searchKeywords: string[];
  confidence: number;
  needsUserConfirmation: boolean;
  ambiguityReason?: string;
  candidateEntities?: RawCandidateEntity[];
  researchHints?: string[];
  notes?: string;
  freshnessProfile: string;
  freshnessReason: string;
  timeIntent: string;
  timeIntentReason: string;
  understanding: RawTopicUnderstanding;
}

interface RawTopicUnderstanding {
  topicKind: string;
  normalizedTopic: string;
  entityName: string | null;
  entityType: string | null;
  primaryGenreId: string;
  secondaryGenreIds: string[];
  auxiliaryGenreIds: string[];
  informationTypes: string[];
  crossGenreTags: string[];
  prioritySignals: string[];
  negativeSignals: string[];
  searchHints: string[];
  sourceHints: string[];
  audienceLevel: string;
  locationIntent: { required: boolean; locationText: string | null };
  ambiguity: {
    isAmbiguous: boolean;
    reason: string | null;
    candidateMeanings: string[];
  };
  userIntentSummary: string;
}

// AIの自由な判定だけに頼らず、明確に鮮度が決まっているキーワードは機械的に上書きする
// （災害速報が"daily"判定される、季節イベントが"evergreen"判定される、といった
// ブレを防ぐための安全弁。ChatGPTとの検討で決めた代表例を反映している）。
const FRESHNESS_RULE_KEYWORDS: { pattern: RegExp; profile: FreshnessProfile }[] = [
  { pattern: /地震|台風|津波|噴火|避難|警報|土砂災害|大雨|洪水|停電|交通障害|事故速報/, profile: "breaking" },
  { pattern: /花火大会|夏祭り|夏まつり|地域イベント|期間限定|フェス|フェスティバル|開催決定|キャンペーン/, profile: "seasonal" },
  { pattern: /株価|為替|仮想通貨|相場|市況|選挙速報/, profile: "high_frequency" },
];

function normalizeFreshnessProfile(value: string): FreshnessProfile {
  return (FRESHNESS_PROFILES as string[]).includes(value)
    ? (value as FreshnessProfile)
    : "daily";
}

function applyFreshnessProfileRules(
  subjectText: string,
  aiProfile: FreshnessProfile,
): FreshnessProfile {
  for (const rule of FRESHNESS_RULE_KEYWORDS) {
    if (rule.pattern.test(subjectText)) return rule.profile;
  }
  return aiProfile;
}

function normalizeTimeIntent(value: string): TimeIntent {
  return (TIME_INTENTS as string[]).includes(value)
    ? (value as TimeIntent)
    : "current_or_future";
}

// 「過去」「歴史」「〇〇年代」のような明示的な時期指定は、AIの判定によらず
// historicalへ機械的に上書きする（古い情報を誤って除外してしまうと、ユーザーが
// 本来求めている情報にたどり着けなくなるため、明確なキーワードは優先する）。
const HISTORICAL_KEYWORD_PATTERN =
  /過去|歴史|昔|かつて|懐かし|全盛期|活動休止前|解散前|引退前|\d{1,4}年代/;

function applyTimeIntentRules(subjectText: string, aiIntent: TimeIntent): TimeIntent {
  if (HISTORICAL_KEYWORD_PATTERN.test(subjectText)) return "historical";
  return aiIntent;
}

function normalizeAudienceLevel(value: string): AudienceLevel {
  return (AUDIENCE_LEVELS as string[]).includes(value)
    ? (value as AudienceLevel)
    : "unknown";
}

function normalizeTopicKind(value: string | undefined): TopicKind {
  return value && (TOPIC_KINDS as string[]).includes(value)
    ? (value as TopicKind)
    : "unknown";
}

function normalizePrimaryGenreId(value: string | undefined): string {
  return value && isValidGenreId(value) ? value : "unknown";
}

// secondaryGenreIds/auxiliaryGenreIdsは「強い関連ジャンル：最大2件」という仕様上の
// 上限をここで機械的に強制する（JSON SchemaのarrayにはminItems/maxItemsを0/1以外で
// 指定できないという既知の制約があるため、プロンプト指示＋コード側の切り詰めで担保する）。
function normalizeGenreIdList(values: string[] | undefined, options: { max?: number; exclude?: string } = {}): string[] {
  if (!values) return [];
  const unique = Array.from(new Set(values.filter((v) => isValidGenreId(v) && v !== options.exclude)));
  return options.max ? unique.slice(0, options.max) : unique;
}

function normalizeUnderstandingInformationTypes(values: string[] | undefined): string[] {
  if (!values) return [];
  return values.filter((v) => isValidInformationType(v));
}

function normalizeUnderstanding(
  topicName: string,
  raw: RawTopicUnderstanding | undefined,
  fallbackTopicKind: TopicKind = "unknown",
): TopicUnderstanding {
  if (!raw) {
    // AIが（スキーマ違反等で）understandingを返さなかった場合の安全なフォールバック。
    // 情報を広げすぎないよう、対象を絞らないカテゴリ・空の優先/除外シグナルにする。
    return {
      topicKind: fallbackTopicKind,
      normalizedTopic: topicName,
      entityName: null,
      entityType: null,
      primaryGenreId: "unknown",
      secondaryGenreIds: [],
      auxiliaryGenreIds: [],
      informationTypes: [],
      crossGenreTags: [],
      appliedCrossGenreRuleIds: [],
      category: "other",
      informationNeeds: [],
      prioritySignals: [],
      negativeSignals: [],
      searchHints: [],
      sourceHints: [],
      audienceLevel: "unknown",
      locationIntent: { required: false, locationText: null },
      ambiguity: { isAmbiguous: false, reason: null, candidateMeanings: [] },
      userIntentSummary: topicName,
    };
  }

  const primaryGenreId = normalizePrimaryGenreId(raw.primaryGenreId);
  const secondaryGenreIds = normalizeGenreIdList(raw.secondaryGenreIds, { max: 2, exclude: primaryGenreId });
  const auxiliaryGenreIds = normalizeGenreIdList(raw.auxiliaryGenreIds, { exclude: primaryGenreId }).filter(
    (id) => !secondaryGenreIds.includes(id),
  );
  const informationTypes = normalizeUnderstandingInformationTypes(raw.informationTypes);
  const crossGenreTags = raw.crossGenreTags ?? [];
  const appliedCrossGenreRuleIds = findApplicableCrossGenreRules({
    primaryGenreId,
    secondaryGenreIds,
    informationTypes,
    topicText: `${topicName} ${crossGenreTags.join(" ")}`,
  }).map((rule) => rule.ruleId);

  return {
    topicKind: normalizeTopicKind(raw.topicKind),
    normalizedTopic: raw.normalizedTopic || topicName,
    entityName: raw.entityName,
    entityType: raw.entityType,
    primaryGenreId,
    secondaryGenreIds,
    auxiliaryGenreIds,
    informationTypes,
    crossGenreTags,
    appliedCrossGenreRuleIds,
    // category/informationNeedsは33ジャンル体系（primaryGenreId/informationTypes）に
    // 統合され、AIへの分類要求からは外した（enumを積みすぎるとAnthropic API側で
    // 「コンパイル済み文法が大きすぎる」400エラーになることを実機検証で確認したため）。
    // 後方互換の読み取り専用フィールドとして残し、常に既定値を返す。
    category: "other",
    informationNeeds: [],
    prioritySignals: raw.prioritySignals ?? [],
    negativeSignals: raw.negativeSignals ?? [],
    searchHints: raw.searchHints ?? [],
    sourceHints: raw.sourceHints ?? [],
    audienceLevel: normalizeAudienceLevel(raw.audienceLevel),
    locationIntent: {
      required: raw.locationIntent?.required ?? false,
      locationText: raw.locationIntent?.locationText ?? null,
    },
    ambiguity: {
      isAmbiguous: raw.ambiguity?.isAmbiguous ?? false,
      reason: raw.ambiguity?.reason ?? null,
      candidateMeanings: raw.ambiguity?.candidateMeanings ?? [],
    },
    userIntentSummary: raw.userIntentSummary || topicName,
  };
}

function normalizeEntityType(value: string): TopicEntityType {
  return (TOPIC_ENTITY_TYPES as string[]).includes(value)
    ? (value as TopicEntityType)
    : "unknown";
}

function normalizeSourceTypes(values: string[]): SourceType[] {
  const normalized = values.filter((v): v is SourceType =>
    (SOURCE_TYPES as string[]).includes(v),
  );
  return normalized.length > 0 ? normalized : ["other"];
}

function normalizeCandidateEntities(
  values: RawCandidateEntity[] | undefined,
): TopicCandidateEntity[] {
  if (!values) return [];
  return values.map((v) => ({
    label: v.label,
    entityType: normalizeEntityType(v.entityType),
    parentCategory: v.parentCategory,
    subCategory: v.subCategory,
    detailCategory: v.detailCategory,
    description: v.description,
    confidence: Math.min(1, Math.max(0, v.confidence)),
  }));
}

function normalizeClassification(
  topicName: string,
  raw: RawTopicClassification,
  context: string | undefined,
): TopicClassification {
  const entityType = normalizeEntityType(raw.entityType);
  const confidence = Math.min(1, Math.max(0, raw.confidence));
  const candidateEntities = normalizeCandidateEntities(raw.candidateEntities);

  const subjectText = `${topicName} ${context ?? ""}`;
  const freshnessProfile = applyFreshnessProfileRules(
    subjectText,
    normalizeFreshnessProfile(raw.freshnessProfile),
  );
  const freshnessDefaults = FRESHNESS_PROFILE_DEFAULTS[freshnessProfile];
  const timeIntent = applyTimeIntentRules(subjectText, normalizeTimeIntent(raw.timeIntent));
  const understanding = normalizeUnderstanding(topicName, raw.understanding);
  // parentCategory/subCategory/detailCategory（自由記述、非推奨）は、AIに生成させず
  // primaryGenreId系から機械的に導出する（既存カラム・既存UIとの後方互換のため）。
  const legacyCategoryFields = deriveLegacyCategoryFields(
    understanding.primaryGenreId,
    understanding.secondaryGenreIds,
    understanding.informationTypes,
  );

  return {
    // AIが返したtopicNameではなく、必ず元の入力を保持する
    topicName,
    entityType,
    ...legacyCategoryFields,
    summary: raw.summary,
    intentTags: raw.intentTags,
    recommendedSourceTypes: normalizeSourceTypes(raw.recommendedSourceTypes),
    searchKeywords: raw.searchKeywords,
    confidence,
    // entityTypeがunknown、または解釈候補が複数ある場合は、AIの値によらず確認要とする
    needsUserConfirmation:
      raw.needsUserConfirmation ||
      entityType === "unknown" ||
      candidateEntities.length > 1,
    ambiguityReason: raw.ambiguityReason,
    candidateEntities,
    researchHints: raw.researchHints ?? [],
    notes: raw.notes,
    freshnessProfile,
    freshnessReason: raw.freshnessReason,
    minRefreshIntervalMinutes: freshnessDefaults.minRefreshIntervalMinutes,
    defaultCardTtlHours: freshnessDefaults.defaultCardTtlHours,
    timeIntent,
    timeIntentReason: raw.timeIntentReason,
    understanding,
  };
}

// classifyTopic自体の呼び出しが失敗した場合（Anthropic APIのクレジット残高不足等）に、
// トピック登録全体を失敗させないための最小限のフォールバック分類。
// confidenceを低くしneedsUserConfirmationをtrueにすることで、「AI分類できなかった」ことが
// UI上でも分かるようにしている。呼び出し元（previewTopicRegistration等）で
// identifiedEntity由来の情報により上書きされる想定。
export function buildFallbackClassification(
  topicName: string,
  context?: string,
): TopicClassification {
  const freshnessDefaults = FRESHNESS_PROFILE_DEFAULTS.daily;
  const legacyCategoryFields = deriveLegacyCategoryFields("unknown", [], []);
  return {
    topicName,
    entityType: "unknown",
    ...legacyCategoryFields,
    summary: `${topicName}に関する情報を収集します（AI分類に失敗したため簡易分類です）。`,
    intentTags: [],
    recommendedSourceTypes: ["other"],
    searchKeywords: [topicName],
    confidence: 0.3,
    needsUserConfirmation: true,
    ambiguityReason: "AIによる分類呼び出しに失敗したため、詳細を確認できませんでした。",
    candidateEntities: [],
    researchHints: [],
    notes: context
      ? `AI分類（classifyTopic）の呼び出しに失敗したため、フォールバック値を使用しています。補足情報: ${context}`
      : "AI分類（classifyTopic）の呼び出しに失敗したため、フォールバック値を使用しています。",
    freshnessProfile: "daily",
    freshnessReason: "AI分類に失敗したため既定値を使用しています。",
    minRefreshIntervalMinutes: freshnessDefaults.minRefreshIntervalMinutes,
    defaultCardTtlHours: freshnessDefaults.defaultCardTtlHours,
    timeIntent: "current_or_future",
    timeIntentReason: "AI分類に失敗したため既定値を使用しています。",
    understanding: normalizeUnderstanding(topicName, undefined),
  };
}

export async function classifyTopic(
  topicName: string,
  // 対象特定ゲート（identifyTopicEntity）で既に確定済みの対象情報がある場合に渡す。
  // 渡された場合、classifyTopicはこの内容を前提に分類し、曖昧判定（needsUserConfirmation等）を
  // 行わない（システムプロンプト側の指示）。トピック名だけでは曖昧な短い名前（例:"shin"）でも、
  // 確定済みの文脈を使って正しく分類できるようにするためのもの。
  context?: string,
): Promise<TopicClassification> {
  const userContent = context
    ? `トピック名: ${topicName}\n\n補足情報（対象特定ゲートで確認済み。この内容を前提に分類してください）:\n${context}`
    : `トピック名: ${topicName}`;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            topicName: { type: "string" },
            entityType: { type: "string", enum: TOPIC_ENTITY_TYPES },
            summary: {
              type: "string",
              description: "このトピックが何であるかの一行説明",
            },
            intentTags: { type: "array", items: { type: "string" } },
            recommendedSourceTypes: {
              type: "array",
              items: { type: "string", enum: SOURCE_TYPES },
            },
            searchKeywords: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
            needsUserConfirmation: { type: "boolean" },
            ambiguityReason: {
              type: "string",
              description: "needsUserConfirmationがtrueの場合に、なぜ確認が必要かの理由",
            },
            candidateEntities: {
              type: "array",
              description:
                "トピック名が曖昧な場合の解釈候補。曖昧でない場合は空配列にする",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  entityType: { type: "string", enum: TOPIC_ENTITY_TYPES },
                  parentCategory: { type: "string" },
                  subCategory: { type: "string" },
                  detailCategory: { type: "string" },
                  description: { type: "string" },
                  confidence: { type: "number" },
                },
                required: [
                  "label",
                  "entityType",
                  "parentCategory",
                  "subCategory",
                  "description",
                  "confidence",
                ],
                additionalProperties: false,
              },
            },
            researchHints: {
              type: "array",
              description: "将来Web調査やSNS調査をする場合に確認すべき観点",
              items: { type: "string" },
            },
            notes: { type: "string" },
            freshnessProfile: { type: "string", enum: FRESHNESS_PROFILES },
            freshnessReason: { type: "string" },
            timeIntent: { type: "string", enum: TIME_INTENTS },
            timeIntentReason: { type: "string" },
            understanding: {
              type: "object",
              properties: {
                topicKind: {
                  type: "string",
                  enum: TOPIC_KINDS.filter((k) => k !== "ambiguous_topic"),
                },
                normalizedTopic: { type: "string" },
                entityName: { type: ["string", "null"] },
                entityType: { type: ["string", "null"] },
                // genreId/informationTypeの候補一覧はSYSTEM_PROMPT側で自然言語として渡した上で、
                // ここではenum制約を付けない（33件×3箇所＋116件のenumを積むとAnthropic API側で
                // 「コンパイル済み文法が大きすぎる」400エラーになり、実機検証で全トピックの分類が
                // 確実に失敗することを確認したため）。normalizePrimaryGenreId/normalizeGenreIdList/
                // normalizeUnderstandingInformationTypesが不正な値を"unknown"化・除外するため、
                // enum制約が無くても最終的な型の安全性は保たれる。
                primaryGenreId: { type: "string" },
                secondaryGenreIds: { type: "array", items: { type: "string" } },
                auxiliaryGenreIds: { type: "array", items: { type: "string" } },
                informationTypes: { type: "array", items: { type: "string" } },
                crossGenreTags: { type: "array", items: { type: "string" } },
                prioritySignals: { type: "array", items: { type: "string" } },
                negativeSignals: { type: "array", items: { type: "string" } },
                searchHints: { type: "array", items: { type: "string" } },
                sourceHints: { type: "array", items: { type: "string" } },
                audienceLevel: { type: "string", enum: AUDIENCE_LEVELS },
                locationIntent: {
                  type: "object",
                  properties: {
                    required: { type: "boolean" },
                    locationText: { type: ["string", "null"] },
                  },
                  required: ["required", "locationText"],
                  additionalProperties: false,
                },
                ambiguity: {
                  type: "object",
                  properties: {
                    isAmbiguous: { type: "boolean" },
                    reason: { type: ["string", "null"] },
                    candidateMeanings: { type: "array", items: { type: "string" } },
                  },
                  required: ["isAmbiguous", "reason", "candidateMeanings"],
                  additionalProperties: false,
                },
                userIntentSummary: { type: "string" },
              },
              required: [
                "topicKind",
                "normalizedTopic",
                "entityName",
                "entityType",
                "primaryGenreId",
                "secondaryGenreIds",
                "auxiliaryGenreIds",
                "informationTypes",
                "crossGenreTags",
                "prioritySignals",
                "negativeSignals",
                "searchHints",
                "sourceHints",
                "audienceLevel",
                "locationIntent",
                "ambiguity",
                "userIntentSummary",
              ],
              additionalProperties: false,
            },
          },
          required: [
            "topicName",
            "entityType",
            "summary",
            "intentTags",
            "recommendedSourceTypes",
            "searchKeywords",
            "confidence",
            "needsUserConfirmation",
            "candidateEntities",
            "researchHints",
            "freshnessProfile",
            "freshnessReason",
            "timeIntent",
            "timeIntentReason",
            "understanding",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AIがトピックの分類を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  const parseResult = parseAiJsonSafely<RawTopicClassification>(textBlock.text);
  if (!parseResult.ok) {
    throw new Error(
      `AIの応答（トピック分類）のJSON解析に失敗しました: ${parseResult.errorMessage} / 応答: ${parseResult.responsePreview}`,
    );
  }

  return normalizeClassification(topicName, parseResult.data, context);
}
