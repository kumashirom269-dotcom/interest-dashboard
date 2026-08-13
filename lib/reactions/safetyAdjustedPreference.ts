// 安全上の学習制限（仕様書7-3）。高リスク情報では、ユーザー嗜好（リアクション学習）が
// 信頼性・安全性を上回らないようにする。effectiveUserPreferenceWeight = base * riskAdjustment。
import type { RiskLevel } from "@/lib/genres/types";

const RISK_ADJUSTMENT: Record<RiskLevel, number> = {
  normal: 1.0,
  moderate: 0.7,
  high: 0.3,
  critical: 0.05,
};

export function computeEffectiveUserPreferenceWeight(
  baseUserPreferenceWeight: number,
  riskLevel: RiskLevel,
): number {
  return baseUserPreferenceWeight * RISK_ADJUSTMENT[riskLevel];
}
