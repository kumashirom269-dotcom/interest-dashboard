// AI呼び出しのコスト（API呼び出し回数・入力/出力トークン量）を抑えるための設定。
// 開発中にAnthropic APIのクレジットを大きく消費しないよう、検索件数・精査対象・
// カード生成数・AIに渡すテキスト量をまとめてここで管理する。
//
// AI_COST_SAVING_MODEは環境変数 AI_COST_SAVING_MODE=true|false で明示的に切り替えられる。
// 未設定の場合、本番環境（NODE_ENV=production）ではOFF、それ以外（開発環境）ではONを既定値にする
// （開発中にうっかり大量のAPI呼び出しをしてしまうことを防ぐための安全側のデフォルト）。
function resolveCostSavingMode(): boolean {
  const raw = process.env.AI_COST_SAVING_MODE;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export const AI_COST_SAVING_MODE = resolveCostSavingMode();

export interface AiLimits {
  // 1トピックあたり、research_resultsへ保存する検索・公式サイトクロール結果の上限
  // （超過分はofficial_site/event_site/news_site等の優先チャネル・新しいものを優先して残す）。
  maxResearchResultsPerTopic: number;
  // AI精査（vetResearchCandidates）に渡すクラスタ数の上限。超過分はAIに渡さず、
  // 安全側でhold扱いにする（除外はしない。カード数が足りない場合のバックフィル候補にする）。
  maxClustersForVetting: number;
  // 1回のAI精査呼び出しで渡すクラスタ数。多すぎるとAIの応答が長くなりJSONが
  // 途中で切れやすくなるため、小さいバッチに分割して呼び出す。
  vettingBatchSize: number;
  // 1トピックあたりのおすすめカード生成数の上限。
  maxCardsPerTopic: number;
  // AI精査・カード生成へ渡すtitle/snippet等のテキストの最大文字数（それ以上は切り詰める）。
  maxTitleLengthForAi: number;
  maxSnippetLengthForAi: number;
  // fetchWebPageSummaryによるページ要約取得を試みる件数の上限（初期収集・追加検索それぞれ）。
  maxPageSummariesToFetchInitial: number;
  maxPageSummariesToFetchFollowUp: number;
  // evaluateResearchCoverageが不足と判断した場合に実行する追加検索クエリ数の上限。
  maxFollowUpQueries: number;
  // ResearchPlanから展開する検索クエリ（Brave検索実行分）の総数の上限。
  maxBraveQueriesPerTopic: number;
  // 検索1クエリあたりに取得する結果件数の上限。
  maxResultsPerBraveQuery: number;
}

// 実データ検証（2026年8月・「渋谷 新しいカフェ」等の地域探索型トピックでの実測）で判明した
// 問題点への対応: maxBraveQueriesPerTopicが3のままだと、officialSiteQuery系のクエリだけで
// 上限に達してしまい、plan.searchQueries/eventQueries（一般検索・イベント検索）が一切
// 実行されないまま検索結果の多様性が失われ、AI精査でuse判定が0件になる事例が実際に発生した
// （同じトピックをmaxBraveQueriesPerTopic=12で実行すると、具体的な新店情報のカードが
// 生成できることを確認済み）。開発中のAPIコスト抑制と最低限の品質確保を両立するため、
// 3→6へ引き上げる（それでも本番のSTANDARD_LIMITSの半分）。
const SAVING_LIMITS: AiLimits = {
  maxResearchResultsPerTopic: 20,
  maxClustersForVetting: 20,
  vettingBatchSize: 5,
  maxCardsPerTopic: 4,
  maxTitleLengthForAi: 120,
  maxSnippetLengthForAi: 240,
  maxPageSummariesToFetchInitial: 1,
  maxPageSummariesToFetchFollowUp: 1,
  maxFollowUpQueries: 3,
  maxBraveQueriesPerTopic: 6,
  maxResultsPerBraveQuery: 5,
};

const STANDARD_LIMITS: AiLimits = {
  maxResearchResultsPerTopic: 80,
  maxClustersForVetting: 60,
  vettingBatchSize: 10,
  maxCardsPerTopic: 10,
  maxTitleLengthForAi: 200,
  maxSnippetLengthForAi: 400,
  maxPageSummariesToFetchInitial: 3,
  maxPageSummariesToFetchFollowUp: 2,
  maxFollowUpQueries: 5,
  maxBraveQueriesPerTopic: 12,
  maxResultsPerBraveQuery: 5,
};

export const AI_LIMITS: AiLimits = AI_COST_SAVING_MODE ? SAVING_LIMITS : STANDARD_LIMITS;
