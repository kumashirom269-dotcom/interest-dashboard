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
import type { RiskLevel } from "@/lib/genres/types";

const PET_HEALTH_INFORMATION_TYPES = new Set([
  "poisoning",
  "adverse_effect",
  "food_poisoning",
  "warning",
  "alert",
  "recall",
]);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildHighRiskWarnings(input: {
  genreId: string;
  informationTypes: string[];
  riskLevel: RiskLevel;
}): string[] {
  if (input.riskLevel !== "high" && input.riskLevel !== "critical") return [];

  if (
    input.genreId === "pets_animals" &&
    input.informationTypes.some((t) => PET_HEALTH_INFORMATION_TYPES.has(t))
  ) {
    return [
      "緊急時は自己判断せず、まず動物病院または専門機関（動物病院・中毒に関する専門相談窓口等）へ連絡してください。",
      "この情報は個別の診断・治療の代わりにはなりません。自己判断で吐かせる等の処置をしないでください。",
      "動物種・体重・摂取量・症状により対応が異なります。必ず個別に獣医師等の専門家へ確認してください。",
      `情報確認日: ${today()}`,
    ];
  }

  // 上記以外でhigh/criticalになるケース（医療・災害・金融等の横断ルール由来）向けの
  // 汎用警告。ジャンル固有の詳細な警告文は今後カバレッジを拡大する。
  return [
    "この情報は一般的な内容です。個別の状況への適用は、公式情報源または専門家に必ず確認してください。",
    `情報確認日: ${today()}`,
  ];
}
