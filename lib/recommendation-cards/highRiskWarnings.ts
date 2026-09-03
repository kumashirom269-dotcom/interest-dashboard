// high/criticalリスクのカードに必須で付与する警告文（レビュー指摘#3）。
// riskLevelがhigh/criticalなのにwarnings=[]で保存される事例が実機検証で見つかったため、
// ジャンル・informationTypeに応じた注意喚起を機械的に生成する。
//
// 常に少なくとも1件以上の警告（ジャンル固有の詳細警告、無ければ汎用の確認喚起文）を返し、
// null（生成不能につきhold）は返さない。以前はnullを「カード化見送りの判断材料」として
// 呼び出し側に渡す設計だったが、実装上どの入力でも必ず配列を返すため、その分岐は
// 到達不能なまま残っていた（呼び出し側の`if (cardWarnings === null)`は常にfalse）。
// 「high/criticalのカードにwarnings=[]は許さない」という本来の目的は、この汎用フォール
// バックによって既に満たされているため、null分岐は廃止し実装と型を一致させている。
//
// ジャンル固有の詳細警告文は、以前はgenreId === "pets_animals"のハードコード分岐だった。
// lib/genres/genreConfigs.tsのGenreDetailedConfig.highRiskWarningを見るように変更し、
// 他のジャンルにも同じ仕組みで（各ジャンルの専門知識に基づいた文言を用意すれば）
// 拡張できるようにした（レビュー指摘）。
import type { RiskLevel } from "@/lib/genres/types";
import { getGenreConfig } from "@/lib/genres/genreConfigs";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildHighRiskWarnings(input: {
  genreId: string;
  informationTypes: string[];
  riskLevel: RiskLevel;
}): string[] {
  if (input.riskLevel !== "high" && input.riskLevel !== "critical") return [];

  const genreConfig = getGenreConfig(input.genreId);
  const warningConfig = genreConfig?.highRiskWarning;

  if (
    warningConfig &&
    input.informationTypes.some((t) => warningConfig.triggerInformationTypes.includes(t))
  ) {
    return [...warningConfig.lines, `情報確認日: ${today()}`];
  }

  // ジャンル固有の詳細警告が無いケース（設定未整備のジャンル、または医療・災害・金融等の
  // 横断ルール由来）向けの汎用警告。
  return [
    "この情報は一般的な内容です。個別の状況への適用は、公式情報源または専門家に必ず確認してください。",
    `情報確認日: ${today()}`,
  ];
}
