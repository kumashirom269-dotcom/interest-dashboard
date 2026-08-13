import { AI_LIMITS } from "@/lib/config/aiLimits";
import type { ResearchChannel, ResearchPlan, ResearchQuery } from "./types";

// ResearchPlan（AIが立てたリサーチ方針）から、実際に検索エンジンへ投げる
// ResearchQuery群を機械的に組み立てる純関数。
//
// 以前はgenerateResearchQueries（AI呼び出し）がクエリ生成そのものを担っていたが、
// 「AIが何を探すべきかを決める」段階はResearchPlan生成（generateResearchPlan）に
// 一本化し、ここでは方針を検索クエリの形に展開するだけにする（方針A）。
// TopicUnderstanding.searchHintsは、ResearchPlan生成時にAIが既に
// plan.searchQueriesへ織り込むことを期待しているが、AIが取りこぼした場合に備えて
// ここでも未カバーのsearchHintsを補完する。
//
// plan.exclusionQueriesは検索には使わない（誤検出しやすい語句の参考情報として
// vetResearchCandidatesにのみ渡す）。

export interface PlannedResearchQuery {
  query: ResearchQuery;
  channel: ResearchChannel;
}

function toQuery(
  text: string,
  purpose: string,
  priority: number,
  expectedResultType: ResearchQuery["expectedResultType"],
  channel: ResearchChannel,
): PlannedResearchQuery {
  return {
    query: { query: text, purpose, priority, expectedResultType },
    channel,
  };
}

// トピック名をクエリへ前置する際、既にクエリ側にトピック名の単語が含まれている場合は
// 重複させない（実データ検証で「渋谷 新しいカフェ 渋谷 カフェ 新規オープン」のような
// 冗長なクエリが生成され、検索語としての情報量が減っていたことが判明したための対応）。
// 単語単位の完全一致でしか判定しない簡易ロジックだが、最も目立つ丸ごと重複は防げる。
function prefixTopicNameIfMissing(topicName: string, query: string): string {
  const topicTokens = topicName.split(/\s+/).filter(Boolean);
  const queryTokens = new Set(query.split(/\s+/).filter(Boolean));
  const missingTokens = topicTokens.filter((t) => !queryTokens.has(t));
  return missingTokens.length > 0 ? `${missingTokens.join(" ")} ${query}` : query;
}

export function buildResearchQueriesFromPlan(
  plan: ResearchPlan,
  searchHints: string[] = [],
): PlannedResearchQuery[] {
  const seen = new Set<string>();
  const planned: PlannedResearchQuery[] = [];

  const push = (item: PlannedResearchQuery) => {
    if (seen.has(item.query.query)) return;
    seen.add(item.query.query);
    planned.push(item);
  };

  // officialSiteQueriesはAIが「公式サイト内で探すべき語句」として短く生成するため
  // （例:"ツアー日程"）、トピック名を付けずにそのままBrave検索へ投げると無関係な結果
  // （他社の同名商品ページ等）が返ってきやすい。トピック名を必ず前置してスコープする。
  for (const q of plan.officialSiteQueries) {
    push(
      toQuery(
        prefixTopicNameIfMissing(plan.topicName, q),
        "公式サイト・公式情報の確認",
        90,
        "official_page",
        "official_site",
      ),
    );
  }

  for (const q of plan.eventQueries) {
    push(toQuery(q, "イベント・日程・会場等の確認", 85, "web_article", "event_site"));
  }

  for (const q of plan.searchQueries) {
    push(toQuery(q, plan.primaryGoal, 70, "web_article", "brave_search"));
  }

  // AIがResearchPlanへ織り込み忘れたsearchHintsの補完。
  for (const hint of searchHints) {
    if (!hint) continue;
    push(toQuery(hint, "ユーザー意図から抽出した補助検索語", 60, "web_article", "brave_search"));
  }

  // API節約モードでは、優先度順（公式サイト→イベント→一般検索→searchHints補完）に
  // 上位のみへ絞る（AI_LIMITS.maxBraveQueriesPerTopic）ことで、Brave検索の呼び出し回数を抑える。
  return planned.slice(0, AI_LIMITS.maxBraveQueriesPerTopic);
}
