// AI精査（vetResearchCandidates）の前段で、AIの判断に頼らず機械的に決定できる
// 除外条件を先に適用する（仕様書6-2「決定的除外」準拠）。日付の新旧判定はLLMが
// 苦手な領域であり、決定的ロジックに任せた方が確実かつAI呼び出しコストも下がる。
import type { TimeIntent } from "@/lib/topic-classification/types";
import type { VettingExcludeReason } from "@/lib/ai/vetResearchCandidates";
import type { RiskLevel } from "@/lib/genres/types";
import {
  containsTier3OnlyProhibitedInformationType,
  requiresTier1,
  type SourceTier,
} from "@/lib/research-review/sourceTier";

export interface DeterministicTemporalFilterInput {
  publishedAt: string | null;
  todayDate: string;
  timeIntent: TimeIntent;
  // ResearchPlan.freshnessPolicy.maxAgeDays（AIが判断した古さの許容日数）。nullなら無制限。
  maxAgeDays: number | null;
}

export interface DeterministicFilterResult {
  excluded: boolean;
  reason?: string;
  excludeReason?: VettingExcludeReason;
}

const PASS: DeterministicFilterResult = { excluded: false };

// timeIntentがhistorical/evergreenの場合は、古い情報を除外してはいけない
// （lib/ai/classifyTopic.tsのtimeIntent定義参照）。
const TIME_INTENTS_ALLOWING_OLD_INFO: TimeIntent[] = ["historical", "evergreen", "specific_period"];

export function applyDeterministicTemporalFilter(
  input: DeterministicTemporalFilterInput,
): DeterministicFilterResult {
  if (!input.publishedAt) return PASS;
  if (input.maxAgeDays == null) return PASS;
  if (TIME_INTENTS_ALLOWING_OLD_INFO.includes(input.timeIntent)) return PASS;

  const publishedMs = Date.parse(input.publishedAt);
  const todayMs = Date.parse(input.todayDate);
  if (Number.isNaN(publishedMs) || Number.isNaN(todayMs)) return PASS;

  const ageDays = Math.floor((todayMs - publishedMs) / (1000 * 60 * 60 * 24));
  if (ageDays <= input.maxAgeDays) return PASS;

  return {
    excluded: true,
    reason: `公開から${ageDays}日経過しており、許容期間(${input.maxAgeDays}日)を超えているため機械的に除外`,
    excludeReason: "too_old",
  };
}

export interface DeterministicRiskFilterInput {
  // ジャンル設定のdefaultRiskLevel。critical/highの場合、Tier1（公式・一次情報）を
  // 必須とする（仕様書6-3「原則として第1層を必要とします」「第3層単独でのカード
  // 生成は禁止」準拠）。
  genreDefaultRiskLevel: RiskLevel;
  officialVerificationRequired: boolean;
  isOfficialSource: boolean;
  // このクラスタで確認できた最も信頼度の高いsourceTier（1が最も公式・一次情報に近い）。
  sourceTier: SourceTier;
  // このクラスタ・トピックに関連する情報タイプ（lib/genres/informationTypes.ts）。
  // 医療・災害・回収等、Tier3単独で確定してはいけない情報タイプが含まれるかの判定に使う。
  informationTypes: string[];
}

export function applyDeterministicRiskFilter(input: DeterministicRiskFilterInput): DeterministicFilterResult {
  // Tier3だけで確定してはいけない情報タイプ（医療・災害・回収等）は、ジャンルの
  // リスクレベルによらず、Tier3の情報源しか無い場合は機械的に除外する。
  if (input.sourceTier === 3 && containsTier3OnlyProhibitedInformationType(input.informationTypes)) {
    return {
      excluded: true,
      reason: "医療・災害・回収等、第3層（補完プラットフォーム）単独で確定してはいけない情報タイプのため機械的に除外",
      excludeReason: "low_credibility",
    };
  }

  if (requiresTier1(input.genreDefaultRiskLevel) && input.sourceTier !== 1 && !input.isOfficialSource) {
    if (input.genreDefaultRiskLevel === "critical") {
      return {
        excluded: true,
        reason: "criticalリスクのジャンルでTier1（公式・一次情報）が確認できないため機械的に除外",
        excludeReason: "low_credibility",
      };
    }
    // highはcriticalほど絶対的ではないため（仕様書6-3「原則として」）、除外ではなく
    // hold相当（呼び出し元でexcludeにせずholdへフォールバックさせる）として扱う。
    return {
      excluded: true,
      reason: "highリスクのジャンルでTier1（公式・一次情報）が確認できないため、安全側でhold相当に倒します",
      excludeReason: undefined,
    };
  }

  if (input.officialVerificationRequired && input.genreDefaultRiskLevel === "critical" && !input.isOfficialSource) {
    return {
      excluded: true,
      reason: "公式確認必須のジャンルで公式情報源が確認できないため機械的に除外",
      excludeReason: "low_credibility",
    };
  }
  return PASS;
}
