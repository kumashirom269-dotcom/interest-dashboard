// 33ジャンル統合エンジンの型定義。
// genreIdは変更に強い永続的な文字列（DBにも保存される）。genreNumberは表示順・
// 設計資料上の番号でしかなく、DB上の永続IDとしては使わない。
export type RiskLevel = "normal" | "moderate" | "high" | "critical";

export const RISK_LEVELS: RiskLevel[] = ["normal", "moderate", "high", "critical"];

export interface GenreDefinition {
  genreId: string;
  genreNumber: number;
  displayName: string;
  aliases: string[];
  configurationVersion: number;
  isActive: boolean;
}

// 第1〜3層は「サイト一覧」ではなく、情報の用途と確定可能な事実範囲を含む収集ポリシー。
export interface GenreSourcePolicy {
  purposes: string[];
  sourceCategories: string[];
  exampleSources: string[];
  allowedUses: string[];
  prohibitedUses: string[];
}

export interface GenreFreshnessRule {
  informationType: string;
  preferredPeriod: string;
  revalidateAtDisplayTime: boolean;
}

export interface GenreScoringWeights {
  relevance: number;
  freshness: number;
  reliability: number;
  novelty: number;
  actionability: number;
  urgency: number;
  regionalFit: number;
  userPreference: number;
  sourceDiversity: number;
  visualQuality: number;
  evergreenValue: number;
}

export interface GenreDetailedConfig {
  genreId: string;
  genreNumber: number;
  displayName: string;
  aliases: string[];
  description: string;

  targetScope: string[];

  sourceLayers: {
    tier1: GenreSourcePolicy;
    tier2: GenreSourcePolicy;
    tier3: GenreSourcePolicy;
  };

  // このジャンルのトピックで優先的に収集すべき情報タイプコード（lib/genres/informationTypes.ts参照）。
  informationTypePriorities: string[];
  normalizationKeys: string[];

  freshnessRules: GenreFreshnessRule[];

  // 他ジャンルへ横断する主な情報タイプ（表示・ドキュメント用途。実際の適用はCrossGenreResearchRuleで行う）。
  crossGenreInformationTypeHints: string[];
  qualityAndSafetyRules: string[];

  requiredFactFields: string[];
  preferredCardTypes: string[];

  defaultRiskLevel: RiskLevel;
  officialVerificationRequired: boolean;
  minimumIndependentSources: number;

  scoringWeights: GenreScoringWeights;

  configurationVersion: number;
  // 媒体名は初期候補であり、ドメインや運営状態を固定的に信用し続けない。
  // このジャンル設定が最後に内容確認された日時（実装時点を初期値とする）。
  lastVerifiedAt: string;

  // high/criticalリスクのカードに付与する、ジャンル固有の詳細警告文
  // （lib/recommendation-cards/highRiskWarnings.ts参照）。未設定のジャンルは汎用の
  // 確認喚起文にフォールバックする。安全上の文言は各ジャンルの専門知識に基づいて
  // 個別に用意する必要があるため、任意フィールドとし既存33ジャンルへの一律追加は行わない
  // （中身の無い警告文を捏造しない）。
  highRiskWarning?: {
    // このinformationTypesのいずれかを含む場合に詳細警告を出す（含まれない場合は汎用警告）。
    triggerInformationTypes: string[];
    lines: string[];
  };

  // 「Verified professional source」（レビュー指摘#1、Tier2相当）の判定に使う、
  // ジャンル固有のキーワードパターン（lib/research-review/sourceTier.ts参照）。
  // 施設種別を示す語と運営情報を示す語の両方が本文中に確認できる場合のみtrueにする方針
  // （ドメイン文字列だけでの認定を避けるため）。未設定のジャンルはこの判定を行わない
  // （中身の無いパターンを捏造しない）。
  professionalSourcePatterns?: {
    facility: RegExp;
    corroborating: RegExp;
  };
}

// 仕様書2章「独立ジャンルではなく横断ルールとして扱う領域」に対応する横断ルール定義。
export interface CrossGenreResearchRule {
  ruleId: string;
  displayName: string;
  triggerInformationTypes: string[];
  triggerKeywords: string[];
  applicableGenreIds: string[];

  additionalSourceRequirements: {
    requiredTier1Categories: string[];
    preferredTier2Categories: string[];
    prohibitedTier3Uses: string[];
  };

  riskAdjustment?: {
    minimumRiskLevel: RiskLevel;
    officialVerificationRequired: boolean;
    minimumIndependentSources: number;
  };

  requiredFactFields: string[];
  safetyConstraints: string[];
  preferredCardTypes: string[];
}
