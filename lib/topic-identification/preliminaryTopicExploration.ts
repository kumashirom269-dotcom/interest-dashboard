// トピック登録時、identifyTopicEntityのAI呼び出しの前に行う軽量な事前チェック。
// ネットワークアクセス・追加のAI呼び出しは一切行わない、正規表現ベースの簡易判定のみ。
//
// 本来の構想（ユーザー指示にあるpreliminaryTopicExploration）は、曖昧語・テーマ型の
// トピックについて実際にWeb検索を行い、その結果をAIに解釈させたうえで登録可否・
// 候補意味を判断する、というものだった。しかし、以下の理由から今回はその本格実装を
// 見送り、ルールベースの簡易ヒントに留めている（詳細は実装報告を参照）。
// - identifyTopicEntity自体のAI呼び出し（Claudeの事前知識）だけで、「テレビ」が
//   曖昧語であること・「旬な果物」が季節テーマであることは十分判定できる
// - 新たにWeb検索を挟むと、AI呼び出し回数・レイテンシ・APIコストが増える
//   （API節約モードの方針と相反する）
// - トピック登録前（topics行がまだ存在しない段階）にProviderへtopicIdなしで
//   検索させる設計変更が必要になり、影響範囲が大きい
//
// そのため、ここでは「入力文字列の見た目」から弱いヒントだけを作り、
// identifyTopicEntityのプロンプトへ参考情報として渡すだけに留める。
export type PreliminaryTopicHint =
  | "likely_theme_or_seasonal"
  | "likely_local_discovery"
  | "likely_recommendation"
  | "likely_learning"
  | "likely_trend"
  | "unknown";

export interface PreliminaryTopicExploration {
  hint: PreliminaryTopicHint;
  reason: string;
}

const SEASONAL_KEYWORD_PATTERN = /旬|季節|春|夏|秋|冬|梅雨|イルミネーション/;
// 「高崎市の新しい飲食店」のように、地名の接尾辞と探索系の語句の間に
// 「新しい」等の修飾語が挟まることがあるため、隣接一致ではなく
// 「地名接尾辞を含む」かつ「探索系の語句を含む」の2条件のANDで判定する。
const LOCAL_PLACE_SUFFIX_PATTERN = /(市|町|村|区|県)の/;
const LOCAL_DISCOVERY_KEYWORD_PATTERN =
  /店|イベント|開店|飲食店|スポット|新しい|新規|週末イベント|新規オープン/;
const RECOMMENDATION_PATTERN = /おすすめ|比較|ランキング|選び方|買ってよかった/;
const LEARNING_PATTERN = /初心者|入門|勉強法|学習|ロードマップ|独学/;
const TREND_PATTERN = /話題|流行|トレンド|バズ/;

// 入力文字列の見た目だけからテーマ型・季節型・地域探索型・おすすめ型・学習型・
// トレンド型らしさを推測する。該当しない場合は"unknown"（=identifyTopicEntityの
// AI判定にすべて委ねる）を返す。
export function preliminaryTopicExploration(name: string): PreliminaryTopicExploration {
  if (SEASONAL_KEYWORD_PATTERN.test(name)) {
    return {
      hint: "likely_theme_or_seasonal",
      reason: "季節を示す語句を含むため、季節型テーマの可能性があります。",
    };
  }
  if (
    (LOCAL_PLACE_SUFFIX_PATTERN.test(name) && LOCAL_DISCOVERY_KEYWORD_PATTERN.test(name)) ||
    /週末イベント|新規オープン/.test(name)
  ) {
    return {
      hint: "likely_local_discovery",
      reason: "地域名＋新規・イベント系の語句を含むため、地域探索型の可能性があります。",
    };
  }
  if (RECOMMENDATION_PATTERN.test(name)) {
    return {
      hint: "likely_recommendation",
      reason: "おすすめ・比較系の語句を含むため、おすすめ・比較型テーマの可能性があります。",
    };
  }
  if (LEARNING_PATTERN.test(name)) {
    return {
      hint: "likely_learning",
      reason: "学習・入門系の語句を含むため、学習型テーマの可能性があります。",
    };
  }
  if (TREND_PATTERN.test(name)) {
    return {
      hint: "likely_trend",
      reason: "話題・トレンド系の語句を含むため、トレンド型テーマの可能性があります。",
    };
  }
  return { hint: "unknown", reason: "" };
}
