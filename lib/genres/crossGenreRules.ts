import type { CrossGenreResearchRule } from "@/lib/genres/types";
import { GENRE_IDS } from "@/lib/genres/definitions";

// 仕様書2章「独立ジャンルではなく横断ルールとして扱う領域」に対応する横断ルール定義。
// 健康・医療・ウェルネス、暮らし・住まい、家族・子育て、お酒・嗜好飲料、金融・法律・制度、
// 災害・安全、求人・募集・申請、商品回収・注意喚起の8領域は33ジャンルの独立主ジャンルには
// せず、informationType/crossGenreTagsのトリガーに応じてこのルールを適用する形で扱う。
export const CROSS_GENRE_RESEARCH_RULES: CrossGenreResearchRule[] = [
  {
    ruleId: "health_wellness",
    displayName: "健康・医療・ウェルネス",
    triggerInformationTypes: ["adverse_effect", "poisoning", "infectious_disease"],
    triggerKeywords: ["健康", "睡眠", "ダイエット", "体調", "医療", "ウェルネス"],
    applicableGenreIds: ["sports_fitness", "cooking_baking", "gadgets_digital", "gourmet_dining"],
    additionalSourceRequirements: {
      requiredTier1Categories: ["公的機関", "医療機関", "行政"],
      preferredTier2Categories: ["専門家監修媒体"],
      prohibitedTier3Uses: ["医療的助言の単独確定"],
    },
    riskAdjustment: {
      minimumRiskLevel: "high",
      officialVerificationRequired: true,
      minimumIndependentSources: 2,
    },
    requiredFactFields: ["対象者", "症状・効果の範囲", "出典"],
    safetyConstraints: ["一般記事で診断・治療の断定をしない", "医療専門家への相談を促す"],
    preferredCardTypes: ["health_notice"],
  },
  {
    ruleId: "lifestyle_household",
    displayName: "暮らし・住まい・家事・生活用品",
    triggerInformationTypes: ["new_product", "recall", "price_increase", "price_decrease"],
    triggerKeywords: ["暮らし", "住まい", "家事", "生活用品", "収納", "掃除"],
    applicableGenreIds: ["cooking_baking", "handmade_diy", "gadgets_digital", "stationery_planner"],
    additionalSourceRequirements: {
      requiredTier1Categories: ["メーカー公式"],
      preferredTier2Categories: ["生活情報専門媒体"],
      prohibitedTier3Uses: [],
    },
    requiredFactFields: [],
    safetyConstraints: [],
    preferredCardTypes: ["lifestyle_tip"],
  },
  {
    ruleId: "family_childcare",
    displayName: "家族・子育て・人間関係・ライフイベント",
    triggerInformationTypes: ["child_friendly", "application_deadline", "recruitment", "enrollment"],
    triggerKeywords: ["子育て", "育児", "子ども", "家族", "ライフイベント"],
    applicableGenreIds: ["local_events_festivals", "theme_park_leisure", "travel", "gourmet_dining"],
    additionalSourceRequirements: {
      requiredTier1Categories: ["自治体公式", "施設公式"],
      preferredTier2Categories: ["子育て専門媒体"],
      prohibitedTier3Uses: ["子どもの安全情報の口コミのみでの確定"],
    },
    riskAdjustment: {
      minimumRiskLevel: "moderate",
      officialVerificationRequired: true,
      minimumIndependentSources: 1,
    },
    requiredFactFields: ["対象年齢", "申込締切", "安全上の注意"],
    safetyConstraints: ["child_safetyに関わる情報は公式情報を優先する"],
    preferredCardTypes: ["family_event"],
  },
  {
    ruleId: "alcohol_beverage",
    displayName: "お酒・嗜好飲料",
    // "seasonal_limited"はseasonal_foodルールとも共有される汎用的な情報タイプで、これだけを
    // トリガーにすると「旬の果物」「新規飲食店」等、酒類と無関係なグルメ系トピックにまで
    // 無条件でこのルールが発火してしまう不具合が実機検証で見つかったため、酒類固有の
    // "new_product"のみをトリガー情報タイプとし、それ以外はキーワード一致に委ねる。
    triggerInformationTypes: ["new_product"],
    triggerKeywords: ["お酒", "ビール", "ワイン", "日本酒", "コーヒー", "嗜好飲料"],
    applicableGenreIds: ["gourmet_dining", "cooking_baking", "local_events_festivals"],
    additionalSourceRequirements: {
      requiredTier1Categories: ["メーカー公式"],
      preferredTier2Categories: ["飲料専門媒体"],
      prohibitedTier3Uses: [],
    },
    requiredFactFields: [],
    safetyConstraints: ["未成年飲酒を助長する表現をしない"],
    preferredCardTypes: ["product_release"],
  },
  {
    ruleId: "finance_legal_system",
    displayName: "金融・法律・制度",
    triggerInformationTypes: ["system_start", "system_change", "subsidy", "grant", "benefit"],
    triggerKeywords: ["金融", "法律", "制度", "補助金", "助成金", "税"],
    applicableGenreIds: GENRE_IDS,
    additionalSourceRequirements: {
      requiredTier1Categories: ["行政公式", "官公庁"],
      preferredTier2Categories: [],
      prohibitedTier3Uses: ["制度の解釈をコミュニティ情報のみで確定"],
    },
    riskAdjustment: {
      minimumRiskLevel: "high",
      officialVerificationRequired: true,
      minimumIndependentSources: 1,
    },
    requiredFactFields: ["適用開始日", "対象条件", "申請方法"],
    safetyConstraints: [],
    preferredCardTypes: ["system_notice"],
  },
  {
    ruleId: "disaster_safety",
    displayName: "災害・安全",
    triggerInformationTypes: ["disaster", "evacuation", "warning", "alert", "road_closure", "suspension"],
    triggerKeywords: ["災害", "地震", "台風", "避難", "安全"],
    applicableGenreIds: GENRE_IDS,
    additionalSourceRequirements: {
      requiredTier1Categories: ["自治体公式", "気象庁", "警察", "消防"],
      preferredTier2Categories: [],
      prohibitedTier3Uses: ["第3層単独でのカード生成"],
    },
    riskAdjustment: {
      minimumRiskLevel: "critical",
      officialVerificationRequired: true,
      minimumIndependentSources: 2,
    },
    requiredFactFields: ["発表日時", "対象地域", "現在有効か", "最終確認日時"],
    safetyConstraints: ["公的・公式第1層を必須とする", "明確な注意表示を行う"],
    preferredCardTypes: ["safety_alert"],
  },
  {
    ruleId: "job_recruitment_application",
    displayName: "求人・募集・申請",
    triggerInformationTypes: ["recruitment", "application_start", "application_deadline", "application_closed"],
    triggerKeywords: ["求人", "募集", "申請", "応募"],
    applicableGenreIds: GENRE_IDS,
    additionalSourceRequirements: {
      requiredTier1Categories: ["主催者公式", "行政公式"],
      preferredTier2Categories: [],
      prohibitedTier3Uses: [],
    },
    requiredFactFields: ["募集期間", "対象条件"],
    safetyConstraints: [],
    preferredCardTypes: ["recruitment_notice"],
  },
  {
    ruleId: "product_recall_alert",
    displayName: "商品回収・注意喚起",
    triggerInformationTypes: ["recall", "product_accident", "defect", "counterfeit"],
    triggerKeywords: ["回収", "リコール", "注意喚起", "不具合"],
    applicableGenreIds: GENRE_IDS,
    additionalSourceRequirements: {
      requiredTier1Categories: ["メーカー公式", "行政公式"],
      preferredTier2Categories: [],
      prohibitedTier3Uses: ["回収対象の確定"],
    },
    riskAdjustment: {
      minimumRiskLevel: "high",
      officialVerificationRequired: true,
      minimumIndependentSources: 1,
    },
    requiredFactFields: ["対象製品", "回収理由", "対応方法"],
    safetyConstraints: ["回収対象を公式発表のみで確定する"],
    preferredCardTypes: ["safety_alert"],
  },
  {
    ruleId: "seasonal_food",
    displayName: "季節の食材・味覚",
    triggerInformationTypes: ["harvest_start", "first_shipment", "season_start"],
    triggerKeywords: ["旬", "収穫", "味覚", "直売"],
    applicableGenreIds: ["gourmet_dining", "cooking_baking", "local_events_festivals", "plants_nature"],
    additionalSourceRequirements: {
      requiredTier1Categories: [],
      preferredTier2Categories: ["農業・産地情報媒体"],
      prohibitedTier3Uses: [],
    },
    requiredFactFields: ["産地", "旬の時期"],
    safetyConstraints: [],
    preferredCardTypes: ["seasonal_info"],
  },
];

export function findApplicableCrossGenreRules(input: {
  primaryGenreId: string;
  secondaryGenreIds: string[];
  informationTypes: string[];
  topicText: string;
}): CrossGenreResearchRule[] {
  const genreIds = new Set([input.primaryGenreId, ...input.secondaryGenreIds]);
  const infoTypes = new Set(input.informationTypes);
  const lowerText = input.topicText.toLowerCase();

  return CROSS_GENRE_RESEARCH_RULES.filter((rule) => {
    const genreMatches = rule.applicableGenreIds.some((g) => genreIds.has(g));
    if (!genreMatches) return false;

    const infoTypeMatches = rule.triggerInformationTypes.some((t) => infoTypes.has(t));
    const keywordMatches = rule.triggerKeywords.some((k) => lowerText.includes(k.toLowerCase()));
    return infoTypeMatches || keywordMatches;
  });
}
