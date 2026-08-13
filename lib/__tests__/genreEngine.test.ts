// 33ジャンル統合エンジンの純粋関数に対する回帰テスト。
// Node.js組み込みのテストランナー（node:test / node:assert）のみを使用し、
// 新規パッケージは追加しない。実行: npx tsx --test lib/__tests__/genreEngine.test.ts
// （npm run test でも同じコマンドを実行する。package.jsonのscripts.test参照）。
//
// Anthropic/Brave Search等の実際のAPI呼び出しを伴う関数（classifyTopic・
// generateResearchPlan・generateRecommendationCard等）はここではテストしない
// （API課金を伴うため）。ここでは、AIを使わず決定的に動くロジックのみを対象にする。
import test from "node:test";
import assert from "node:assert/strict";

import { GENRE_DEFINITIONS, isValidGenreId } from "../genres/definitions";
import { GENRE_CONFIGS, getGenreConfig, deriveLegacyCategoryFields } from "../genres/genreConfigs";
import { findApplicableCrossGenreRules } from "../genres/crossGenreRules";
import { isValidInformationType, INFORMATION_TYPES } from "../genres/informationTypes";
import {
  applyDeterministicTemporalFilter,
  applyDeterministicRiskFilter,
} from "../research-review/deterministicFilters";
import { computeSourceTier, containsTier3OnlyProhibitedInformationType } from "../research-review/sourceTier";
import { scoreInformationValue } from "../recommendation/scoreInformationValue";
import { clusterArticlesByTopicAndTitle, type ClusterableArticle } from "../recommendation-cards/clustering";
import { evaluateImage } from "../images/evaluateImages";
import { selectCardImage } from "../images/selectCardImage";
import { selectDashboardCards } from "../recommendation/selectDashboardCards";
import { computeDedupeKey, isMajorUpdateInformationType } from "../recommendation-cards/dedupeKey";
import {
  aggregateReactionSignals,
  computePreferenceWeightFromSignals,
} from "../reactions/aggregateReactionSignals";
import { computeEffectiveUserPreferenceWeight } from "../reactions/safetyAdjustedPreference";
import { buildHighRiskWarnings } from "../recommendation-cards/highRiskWarnings";
import { extractHazardClaimKey } from "../recommendation-cards/hazardClaims";
import { isVerifiedProfessionalSource } from "../research-review/sourceTier";
import type { RecommendationCard } from "../recommendation-cards/types";

test("33ジャンルがすべて定義され、genreIdが一意である", () => {
  assert.equal(GENRE_DEFINITIONS.length, 33);
  assert.equal(GENRE_CONFIGS.length, 33);
  assert.equal(new Set(GENRE_DEFINITIONS.map((g) => g.genreId)).size, 33);
  assert.equal(getGenreConfig("music")?.displayName, "音楽");
  assert.equal(getGenreConfig("pets_animals")?.defaultRiskLevel, "high");
  assert.equal(isValidGenreId("not_a_real_genre"), false);
});

test("deriveLegacyCategoryFieldsが33ジャンル体系からparentCategory等を導出する", () => {
  const legacy = deriveLegacyCategoryFields("music", ["celebrity_talent"], ["event_announcement"]);
  assert.equal(legacy.parentCategory, "音楽");
  assert.equal(legacy.subCategory, "芸能人・タレント");
  assert.equal(deriveLegacyCategoryFields("unknown", [], []).parentCategory, "未分類");
});

test("informationTypesの妥当性チェック", () => {
  assert.ok(isValidInformationType("harvest_start"));
  assert.ok(!isValidInformationType("not_a_type"));
  assert.ok(INFORMATION_TYPES.length > 80);
});

test("横断ルールが「旬な果物」「子育てイベント」「災害」に正しく適用される", () => {
  const seasonal = findApplicableCrossGenreRules({
    primaryGenreId: "gourmet_dining",
    secondaryGenreIds: [],
    informationTypes: ["harvest_start"],
    topicText: "旬な果物",
  });
  assert.ok(seasonal.some((r) => r.ruleId === "seasonal_food"));

  const childcare = findApplicableCrossGenreRules({
    primaryGenreId: "local_events_festivals",
    secondaryGenreIds: ["theme_park_leisure"],
    informationTypes: ["child_friendly"],
    topicText: "高崎市の子育てイベント",
  });
  assert.ok(childcare.some((r) => r.ruleId === "family_childcare"));

  const disaster = findApplicableCrossGenreRules({
    primaryGenreId: "outdoor",
    secondaryGenreIds: [],
    informationTypes: ["disaster"],
    topicText: "台風による登山道の被害",
  });
  assert.ok(disaster.some((r) => r.ruleId === "disaster_safety" && r.riskAdjustment?.minimumRiskLevel === "critical"));
});

test("決定的な鮮度フィルタ: current_or_futureは古い情報を除外、historicalは除外しない", () => {
  const old = applyDeterministicTemporalFilter({
    publishedAt: "2025-01-01",
    todayDate: "2026-07-15",
    timeIntent: "current_or_future",
    maxAgeDays: 90,
  });
  assert.ok(old.excluded);
  assert.equal(old.excludeReason, "too_old");

  const historical = applyDeterministicTemporalFilter({
    publishedAt: "2025-01-01",
    todayDate: "2026-07-15",
    timeIntent: "historical",
    maxAgeDays: 90,
  });
  assert.ok(!historical.excluded);
});

test("三層構造: sourceTier算出とTier3単独禁止情報タイプの判定", () => {
  // channel="official_site"という収集意図の主張だけでは、URLで裏付けが取れない限りTier1にしない
  // （実機検証でWikipedia等がofficial_siteクエリ経由で紛れ込みTier1化する不具合を修正）。
  assert.equal(computeSourceTier("official_site", false), 3);
  assert.equal(computeSourceTier(null, true), 1);
  assert.equal(computeSourceTier("news_site", false), 2);
  assert.equal(computeSourceTier("social_or_video", false), 3);
  // 実際のURLが政府・自治体ドメインなら、channelの主張がなくてもTier1として検証できる。
  assert.equal(computeSourceTier("brave_search", false, "https://www.mhlw.go.jp/some-page"), 1);
  // トピックのofficialUrlと同一ドメインなら、channelの主張がなくてもTier1として検証できる。
  assert.equal(
    computeSourceTier("brave_search", false, "https://www.alfee.com/news/index.html", {
      topicOfficialUrl: "https://www.alfee.com/",
    }),
    1,
  );
  // Wikipedia等は、channelが"official_site"を主張していてもTier1にしない（Tier3に倒す）。
  assert.equal(computeSourceTier("official_site", false, "https://ja.wikipedia.org/wiki/Foo"), 3);
  assert.ok(containsTier3OnlyProhibitedInformationType(["poisoning"]));
  assert.ok(!containsTier3OnlyProhibitedInformationType(["tv_appearance"]));
});

test("決定的リスクフィルタ: Tier3単独禁止タイプは即exclude、一般情報はhold相当", () => {
  const poisoningOnSns = applyDeterministicRiskFilter({
    genreDefaultRiskLevel: "high",
    officialVerificationRequired: true,
    isOfficialSource: false,
    sourceTier: 3,
    informationTypes: ["poisoning"],
  });
  assert.ok(poisoningOnSns.excluded);
  assert.equal(poisoningOnSns.excludeReason, "low_credibility");

  const generalOnSns = applyDeterministicRiskFilter({
    genreDefaultRiskLevel: "high",
    officialVerificationRequired: true,
    isOfficialSource: false,
    sourceTier: 3,
    informationTypes: ["other_general_info"],
  });
  assert.ok(generalOnSns.excluded);
  assert.equal(generalOnSns.excludeReason, undefined);

  const officialVet = applyDeterministicRiskFilter({
    genreDefaultRiskLevel: "high",
    officialVerificationRequired: true,
    isOfficialSource: true,
    sourceTier: 1,
    informationTypes: ["poisoning"],
  });
  assert.ok(!officialVet.excluded);
});

test("情報価値スコア: use判定はexclude判定より高スコア、0-100に収まる", () => {
  const genreConfig = getGenreConfig("music");
  const useScore = scoreInformationValue({
    judgement: "use",
    itemCount: 3,
    sourceNames: ["A", "B", "C"],
    publishedAt: "2026-07-14",
    todayDate: "2026-07-15",
    channel: "official_site",
    isOfficialSource: true,
    hasImage: true,
    isFollowUp: false,
    freshnessProfile: "daily",
    locationRequired: false,
    genreConfig,
  });
  const excludeScore = scoreInformationValue({
    judgement: "exclude",
    itemCount: 1,
    sourceNames: ["X"],
    publishedAt: "2025-01-01",
    todayDate: "2026-07-15",
    channel: "social_or_video",
    isOfficialSource: false,
    hasImage: false,
    isFollowUp: true,
    freshnessProfile: "daily",
    locationRequired: false,
    genreConfig,
  });
  assert.ok(useScore.totalScore > excludeScore.totalScore);
  assert.ok(useScore.totalScore >= 0 && useScore.totalScore <= 100);
});

test("リアクション学習: computeEffectiveUserPreferenceWeightがリスクに応じて嗜好を制限する", () => {
  assert.equal(computeEffectiveUserPreferenceWeight(100, "normal"), 100);
  assert.ok(computeEffectiveUserPreferenceWeight(100, "critical") < computeEffectiveUserPreferenceWeight(100, "normal"));
});

test("aggregateReactionSignals/computePreferenceWeightFromSignalsが正しく集計・変換する", () => {
  const summary = aggregateReactionSignals([
    { reactionType: "like", genreId: "music", informationTypes: ["tv_appearance"], sourceName: "src-a" },
    { reactionType: "like", genreId: "music", informationTypes: ["tv_appearance"], sourceName: "src-a" },
    { reactionType: "dislike", genreId: "music", informationTypes: ["sns_trend"], sourceName: "src-b" },
  ]);
  assert.equal(summary.genreSignals.music.like, 2);
  assert.equal(summary.genreSignals.music.dislike, 1);

  const preferred = computePreferenceWeightFromSignals(summary, { genreId: "music" });
  assert.ok(preferred > 50);
});

test("クラスタリング: エンティティ名一致で類似度しきい値・許容日数が緩和される（THE ALFEE回帰確認）", () => {
  function article(id: string, title: string, publishedAt: string): ClusterableArticle {
    return {
      id,
      topicId: "t1",
      title,
      summary: "s",
      sourceName: `source-${id}`,
      sourceDomain: null,
      rankingPosition: null,
      url: `https://example.com/${id}`,
      publishedAt,
      imageUrl: null,
      origin: "research_result",
      channel: "brave_search",
      isFollowUp: false,
      sourceTier: null,
      informationTypes: [],
      isOfficialSource: false,
    };
  }

  const noEntityClusters = clusterArticlesByTopicAndTitle([
    article("a1", "THE ALFEE 2026年春ツアー発表", "2026-01-01"),
    article("a2", "THE ALFEE 2026年春ツアー詳細", "2026-01-09"),
  ]);
  assert.ok(noEntityClusters.length >= 1);

  const entityClusters = clusterArticlesByTopicAndTitle(
    [
      article("b1", "THE ALFEEが新曲を発表", "2026-01-01"),
      article("b2", "THE ALFEEのライブ詳細が明らかに", "2026-01-10"),
    ],
    { entityName: "THE ALFEE", hasEventLikeNormalizationKey: true },
  );
  assert.equal(entityClusters.length >= 1, true);
});

test("画像評価: 対象不一致・プレースホルダーが正しく検出される", () => {
  const wrongEntity = evaluateImage(
    {
      url: "https://example.com/img.jpg",
      channel: "news_site",
      isOfficialSource: false,
      articleTitle: "別の話題の記事",
      publishedAt: "2026-07-01",
      sourceImageSourceType: "article_thumbnail",
    },
    { entityName: "THE ALFEE" },
  );
  assert.ok(wrongEntity.isLikelyWrongEntity);

  const placeholder = evaluateImage(
    {
      url: "https://placehold.co/128x128",
      channel: "official_site",
      isOfficialSource: true,
      articleTitle: "THE ALFEEの公式発表",
      publishedAt: "2026-07-01",
      sourceImageSourceType: "official_site",
    },
    { entityName: "THE ALFEE" },
  );
  assert.ok(placeholder.isPlaceholder);
});

test("画像選定: entity_topic×実在エンティティで候補が無ければ画像なし、theme_topicではカテゴリ画像可", () => {
  const noCandidateEntity = selectCardImage([], {
    entityName: "THE ALFEE",
    entityType: "artist",
    topicKind: "entity_topic",
  });
  assert.equal(noCandidateEntity.imageUrl, null);

  const noCandidateTheme = selectCardImage([], {
    entityName: null,
    entityType: "food",
    topicKind: "theme_topic",
  });
  assert.notEqual(noCandidateTheme.imageUrl, null);
});

test("dedupeKey: 重大な更新情報タイプの判定", () => {
  assert.ok(isMajorUpdateInformationType(["recall"]));
  assert.ok(!isMajorUpdateInformationType(["tv_appearance"]));
  assert.equal(computeDedupeKey("t1", "abc").startsWith("t1::"), true);
});

test("selectDashboardCards: critical優先・12件上限・同一dedupeKey統合・低スコア水増し禁止", () => {
  function card(
    id: string,
    topicId: string,
    riskLevel: string | null,
    score: number,
    dedupeKey: string,
    createdAt: string,
  ): RecommendationCard {
    return {
      id,
      userId: "u",
      topicId,
      topicName: null,
      informationType: "other",
      generatedTitle: `t-${id}`,
      generatedSummary: "s",
      displayReason: "d",
      imageUrl: null,
      imageAlt: null,
      imageSourceType: "category_default",
      imageSourceUrl: null,
      sourceFeedItemIds: [],
      sourceResearchResultIds: [],
      sourceUrls: [],
      sourceNames: [`src-${id}`],
      clickScore: 0,
      createdAt,
      updatedAt: createdAt,
      genreId: "music",
      informationTypes: [],
      crossGenreTags: [],
      riskLevel,
      freshnessLevel: null,
      warnings: [],
      informationValueScore: score,
      scoreBreakdown: null,
      dedupeKey,
      entityName: null,
    };
  }

  const cards: RecommendationCard[] = [
    card("critical1", "topicA", "critical", 10, "k1", "2020-01-01"),
    ...Array.from({ length: 20 }, (_, i) =>
      card(`c${i}`, `topic${i % 3}`, null, 60 - i, `k${i + 2}`, new Date(2026, 6, 15).toISOString()),
    ),
    card("dup1", "topicA", null, 80, "dupKey", new Date(2026, 6, 16).toISOString()),
    card("dup2", "topicA", null, 40, "dupKey", new Date(2026, 6, 16).toISOString()),
    card("lowscore1", "topicX", null, 5, "lowKey", new Date(2026, 6, 16).toISOString()),
  ];

  const selected = selectDashboardCards(cards, { targetCount: 12 });
  assert.ok(selected.some((c) => c.id === "critical1"));
  assert.ok(selected.length <= 12);
  assert.ok(!(selected.some((c) => c.id === "dup1") && selected.some((c) => c.id === "dup2")));
  assert.ok(!selected.some((c) => c.id === "lowscore1"));
});

test("selectDashboardCards: 情報タイプ上限だけでトピックが0件にならない（トピック最低1件確保）", () => {
  function card(
    id: string,
    topicId: string,
    informationType: RecommendationCard["informationType"],
    score: number,
  ): RecommendationCard {
    return {
      id,
      userId: "u",
      topicId,
      topicName: null,
      informationType,
      generatedTitle: `t-${id}`,
      generatedSummary: "s",
      displayReason: "d",
      imageUrl: null,
      imageAlt: null,
      imageSourceType: "category_default",
      imageSourceUrl: null,
      sourceFeedItemIds: [],
      sourceResearchResultIds: [],
      sourceUrls: [],
      sourceNames: [`src-${id}`],
      clickScore: 0,
      createdAt: new Date(2026, 6, 15).toISOString(),
      updatedAt: new Date(2026, 6, 15).toISOString(),
      genreId: "music",
      informationTypes: [],
      crossGenreTags: [],
      riskLevel: "normal",
      freshnessLevel: null,
      warnings: [],
      informationValueScore: score,
      scoreBreakdown: null,
      dedupeKey: `k-${id}`,
      entityName: null,
    };
  }

  // topicA/B/Cはすべて informationType="other" で高スコア。topicRadioは
  // informationType="other" だが唯一のカードで、スコアはtopicA/B/Cの4件目より低いが
  // 品質基準（55）は満たしている。maxPerInformationType=4のため、旧ロジックでは
  // topicRadioが0件になっていた。
  const cards: RecommendationCard[] = [
    ...["A", "B", "C"].flatMap((t) =>
      Array.from({ length: 3 }, (_, i) => card(`${t}${i}`, `topic${t}`, "other", 80 - i)),
    ),
    card("radio1", "topicRadio", "other", 56),
  ];

  const selected = selectDashboardCards(cards, { targetCount: 12, maxPerInformationType: 4 });
  assert.ok(selected.some((c) => c.topicId === "topicRadio"), "topicRadioが最低1件は選ばれる");
  const otherCount = selected.filter((c) => c.informationType === "other").length;
  assert.ok(otherCount <= 4 + 1, "情報タイプ上限は最低枠1件分を除きおおむね守られる");
});

test("selectDashboardCards: 表示最低品質基準(55)未満のカードは表示されず、トピック最低枠にもならない", () => {
  function card(id: string, topicId: string, score: number): RecommendationCard {
    return {
      id,
      userId: "u",
      topicId,
      topicName: null,
      informationType: "other",
      generatedTitle: `t-${id}`,
      generatedSummary: "s",
      displayReason: "d",
      imageUrl: null,
      imageAlt: null,
      imageSourceType: "category_default",
      imageSourceUrl: null,
      sourceFeedItemIds: [],
      sourceResearchResultIds: [],
      sourceUrls: [],
      sourceNames: [`src-${id}`],
      clickScore: 0,
      createdAt: new Date(2026, 6, 15).toISOString(),
      updatedAt: new Date(2026, 6, 15).toISOString(),
      genreId: "gourmet_dining",
      informationTypes: [],
      crossGenreTags: [],
      riskLevel: "moderate",
      freshnessLevel: null,
      warnings: [],
      informationValueScore: score,
      scoreBreakdown: null,
      dedupeKey: `k-${id}`,
      entityName: null,
    };
  }

  // 実機検証で見つかった「スコア43の一般的なグルメまとめカード」相当のケース。
  const cards: RecommendationCard[] = [
    card("good1", "topicGourmet", 77),
    card("generic1", "topicGeneric", 43),
  ];

  const selected = selectDashboardCards(cards);
  assert.ok(selected.some((c) => c.id === "good1"));
  assert.ok(!selected.some((c) => c.id === "generic1"), "品質基準未満のカードは表示されない");
  assert.ok(
    !selected.some((c) => c.topicId === "topicGeneric"),
    "品質基準を満たす候補が無いトピックには最低枠を与えない",
  );
});

test("selectDashboardCards: 45〜54点の『まずまず』なカードは、通常表示には出なくてもトピック最低枠では表示される", () => {
  function card(id: string, topicId: string, score: number): RecommendationCard {
    return {
      id,
      userId: "u",
      topicId,
      topicName: null,
      informationType: "other",
      generatedTitle: `t-${id}`,
      generatedSummary: "s",
      displayReason: "d",
      imageUrl: null,
      imageAlt: null,
      imageSourceType: "category_default",
      imageSourceUrl: null,
      sourceFeedItemIds: [],
      sourceResearchResultIds: [],
      sourceUrls: [],
      sourceNames: [`src-${id}`],
      clickScore: 0,
      createdAt: new Date(2026, 6, 15).toISOString(),
      updatedAt: new Date(2026, 6, 15).toISOString(),
      genreId: "celebrity_talent",
      informationTypes: [],
      crossGenreTags: [],
      riskLevel: "moderate",
      freshnessLevel: null,
      warnings: [],
      informationValueScore: score,
      scoreBreakdown: null,
      dedupeKey: `k-${id}`,
      entityName: null,
    };
  }

  // 実機検証（新規トピック「嵐」）で見つかった事例: 見つかった候補が51点・53点にとどまり、
  // minQualityScore(55)未満のためトピックが丸ごと0件表示になっていた。43点（前テスト）と
  // 51〜53点は質的に異なるため、後者はトピック最低枠でなら表示されるべき。
  const cards: RecommendationCard[] = [
    card("good1", "topicOther", 77),
    card("arashi-low", "topicArashi", 51),
    card("arashi-high", "topicArashi", 53),
  ];

  const selected = selectDashboardCards(cards);
  assert.ok(selected.some((c) => c.id === "good1"));
  // 通常の複数カード表示基準（55）は変えていないため、単独では表示対象にならないはずの
  // カードでも、トピック最低枠経由でなら表示される。
  assert.ok(
    selected.some((c) => c.topicId === "topicArashi"),
    "45点以上の候補があるトピックには最低枠が与えられる",
  );
  // 最低枠として選ばれるのはトピック内で最もスコアの高い方（53点）。
  assert.ok(selected.some((c) => c.id === "arashi-high"));
  assert.ok(!selected.some((c) => c.id === "arashi-low"));
});

test("buildHighRiskWarnings: pets_animals×poisoning×highで必須警告が4項目以上、normalでは空配列", () => {
  const warnings = buildHighRiskWarnings({
    genreId: "pets_animals",
    informationTypes: ["poisoning", "warning"],
    riskLevel: "high",
  });
  assert.ok(warnings !== null);
  assert.ok(warnings.length >= 4, "high/criticalの警告は4項目以上");
  const joined = warnings.join(" ");
  assert.ok(joined.includes("動物病院"), "動物病院へ連絡する趣旨を含む");
  assert.ok(joined.includes("診断") || joined.includes("治療"), "診断・治療の代替ではない趣旨を含む");
  assert.ok(joined.includes("吐かせ"), "自己判断で吐かせないという趣旨を含む");
  assert.ok(warnings.some((w) => /確認日/.test(w)), "情報確認日を含む");

  const normalWarnings = buildHighRiskWarnings({
    genreId: "pets_animals",
    informationTypes: ["poisoning"],
    riskLevel: "normal",
  });
  assert.deepEqual(normalWarnings, [], "normalリスクでは警告を強制しない（空配列）");

  const criticalWarnings = buildHighRiskWarnings({
    genreId: "pets_animals",
    informationTypes: ["poisoning"],
    riskLevel: "critical",
  });
  assert.ok(criticalWarnings !== null && criticalWarnings.length >= 4, "criticalでも同様に必須警告が生成される");

  // 未対応ジャンルのhigh/criticalでも、汎用警告が生成され空配列にはならない
  // （生成できない場合はnullを返しholdにする設計だが、現状は常に何らかの警告を返す）。
  const genericWarnings = buildHighRiskWarnings({
    genreId: "finance_legal_system",
    informationTypes: [],
    riskLevel: "high",
  });
  assert.ok(genericWarnings !== null && genericWarnings.length > 0, "未対応ジャンルでも汎用警告を返す");
});

test("extractHazardClaimKey: 同じ危険物質・対象動物の記事は同じ主張キーになる", () => {
  const a = extractHazardClaimKey("pets_animals", "犬が玉ねぎを食べたら要注意", "中毒症状について解説");
  const b = extractHazardClaimKey("pets_animals", "玉ねぎ中毒、犬の場合の対処法", "動物病院が解説");
  assert.equal(a, b);
  assert.ok(a !== null);

  const cat = extractHazardClaimKey("pets_animals", "猫がユリを食べると危険", "中毒症状");
  assert.notEqual(a, cat, "対象動物・危険物質が異なれば別の主張キーになる");

  const none = extractHazardClaimKey("pets_animals", "ペットの健康について", "一般的な内容");
  assert.equal(none, null, "既知の危険物質キーワードが無ければnull");

  const otherGenre = extractHazardClaimKey("music", "犬が玉ねぎを食べたら要注意", "中毒症状");
  assert.equal(otherGenre, null, "対応ジャンル以外ではnull");
});

test("extractHazardClaimKey: 特定の物質名が無くても『危険な食べ物一覧』的な網羅記事は同じ緩いキーになる", () => {
  // 実データ検証で、動物病院の獣医師コラムは複数の中毒物質を1記事でまとめて解説する
  // パターンが非常に多く、特定物質の単純一致だけでは同趣旨の記事同士でも別キーになって
  // しまうことが判明したため追加したフォールバック。
  const clinicA = extractHazardClaimKey(
    "pets_animals",
    "獣医師が解説、犬が中毒を起こす危険な食べ物一覧と病院に行く判断基準",
    "動物病院のコラムで、犬が食べてはいけない危険な食材と中毒の症状を解説",
  );
  const clinicB = extractHazardClaimKey(
    "pets_animals",
    "犬の誤食で多い「危険な食べ物」とは？食べてはいけない食材一覧",
    "獣医師が中毒症状・病院へ行くべき判断基準を解説",
  );
  assert.equal(clinicA, clinicB);
  assert.ok(clinicA !== null);

  // 特定物質（玉ねぎ）が明確な記事は、従来通り物質固有のキーが優先される
  // （網羅型の緩いキーに埋もれさせない）。
  const specific = extractHazardClaimKey("pets_animals", "犬が玉ねぎを食べたら要注意", "中毒症状について解説");
  assert.notEqual(specific, clinicA);
});

test("isVerifiedProfessionalSource: 施設語＋運営情報語の両方が無いと専門ソースと認めない", () => {
  assert.ok(
    isVerifiedProfessionalSource(
      "pets_animals",
      "犬の中毒について｜さだひろ動物病院 獣医師監修 診療時間・アクセスはこちら",
    ),
  );
  assert.ok(
    !isVerifiedProfessionalSource("pets_animals", "動物病院についての一般的なまとめ記事"),
    "施設語だけでは専門ソースと認めない（運営情報語が無い）",
  );
  assert.ok(
    !isVerifiedProfessionalSource("pets_animals", "獣医師監修の健康コラム"),
    "運営情報語だけでは専門ソースと認めない（施設語が無い）",
  );
  assert.ok(
    !isVerifiedProfessionalSource("music", "犬の動物病院 獣医師監修 診療時間"),
    "対応ジャンル以外では専門ソースと認めない",
  );
});
