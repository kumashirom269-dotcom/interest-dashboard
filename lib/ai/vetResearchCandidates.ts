import Anthropic from "@anthropic-ai/sdk";
import type { TopicClassification } from "@/lib/topic-classification/types";
import { detectThinOrEmptyResult } from "@/lib/research/detectThinOrEmptyResult";
import type { ResearchChannel, ResearchPlan } from "@/lib/research/types";
import { AI_LIMITS } from "@/lib/config/aiLimits";
import { parseAiJsonSafely } from "./parseAiJsonSafely";
import { isAiCreditOrBillingError } from "./aiErrorHelpers";
import {
  applyDeterministicRiskFilter,
  applyDeterministicTemporalFilter,
} from "@/lib/research-review/deterministicFilters";
import { getGenreConfig } from "@/lib/genres/genreConfigs";
import { computeSourceTier, type SourceTier } from "@/lib/research-review/sourceTier";

const client = new Anthropic();

export type VettingJudgement = "use" | "hold" | "exclude";

export type VettingExcludeReason =
  | "too_old"
  | "low_relevance"
  | "low_credibility"
  | "ended_event"
  | "duplicate"
  | "thin_content"
  | "not_user_intent";

const VETTING_JUDGEMENTS: VettingJudgement[] = ["use", "hold", "exclude"];
const VETTING_EXCLUDE_REASONS: VettingExcludeReason[] = [
  "too_old",
  "low_relevance",
  "low_credibility",
  "ended_event",
  "duplicate",
  "thin_content",
  "not_user_intent",
];

export interface VettingClusterInput {
  clusterIndex: number;
  representativeTitle: string;
  representativeSummary: string;
  sourceNames: string[];
  publishedAt: string | null;
  origin: "feed_item" | "research_result" | "mixed";
  itemCount: number;
  // 代表記事の収集チャネル（lib/research/detectThinOrEmptyResultの判定に使う）。
  channel?: ResearchChannel | null;
  // 公式情報源由来かどうか（lib/research-review/deterministicFiltersの
  // リスク判定に使う）。未指定の場合はfalse扱い。
  isOfficialSource?: boolean;
  // このクラスタの三層構造上のsourceTier。未指定の場合はchannel/isOfficialSourceから
  // computeSourceTier()で機械的に導出する（lib/research-review/sourceTier.ts）。
  sourceTier?: SourceTier;
  // このクラスタ・トピックに関連する情報タイプ（lib/genres/informationTypes.ts）。
  // 未指定の場合はトピック全体のinformationTypesにフォールバックする。
  informationTypes?: string[];
}

export interface VettingResult {
  clusterIndex: number;
  judgement: VettingJudgement;
  reason: string;
  excludeReason?: VettingExcludeReason;
}

export interface VetResearchCandidatesInput {
  topicName: string;
  classification: TopicClassification;
  todayDate: string;
  clusters: VettingClusterInput[];
  // AIが立てたリサーチ方針（generateResearchPlan）。渡された場合、
  // notesForVetting・mustExcludeSignalsを追加の判断材料として使う。
  // 未指定の場合はunderstandingベースの判断のみで従来通り動作する。
  researchPlan?: ResearchPlan;
}

export type VettingBatchErrorType =
  | "parse_error"
  | "refusal"
  | "no_text"
  | "call_failed";

export interface VettingBatchFailure {
  batchIndex: number;
  batchSize: number;
  errorType: VettingBatchErrorType;
  errorMessage: string;
}

export interface VetResearchCandidatesOutput {
  results: VettingResult[];
  batchCount: number;
  failedBatchCount: number;
  parseErrorCount: number;
  failures: VettingBatchFailure[];
}

// Brave検索・RSSの生の取得結果を、そのままカード化する前にAIが精査するステップ。
// 「検索にヒットした／RSSに載っていた」というだけでユーザーに見せるのではなく、
// 関連度・鮮度・信頼度・話題としての価値を判定し、使う/保留/除外を振り分ける。
//
// 出力の堅牢性のために以下を明記する（過去にクラスタ数が多い場合にAIの応答が長くなり、
// JSONが途中で切れて"Unterminated string in JSON"のようなパースエラーが起きたため）。
// - JSON以外の文章・Markdownコードブロックを一切出さない
// - reasonは短く簡潔にする（長文説明はしない）
// - 判断に迷う場合はholdにする（無理にuse/excludeを選ばない）
const SYSTEM_PROMPT = `あなたは、ユーザーの関心トピックに関連して集められた情報（検索結果・RSS記事のまとまり）を、
マイページに表示する価値があるかどうか精査するアシスタントです。

以下の観点で、それぞれの情報のまとまり（クラスタ）について use / hold / exclude を判定してください。

- userIntentSummary（ユーザーが本当に求めている情報）に合っているか。これが最重要の判断軸
- informationNeedsに挙げられている情報の種類に合っているか
- prioritySignalsに該当する内容を含んでいるか（含んでいれば積極的にuseにしてよい）
- negativeSignalsに該当していないか（該当すればexclude。not_user_intentを使う）
- entityNameが指定されている場合、そのエンティティそのものに関する情報か
  （別の対象・別の意味の情報が紛れ込んでいたらexclude。例:「嵐」がアーティストグループとして
  分類されているのに、天候の「嵐」に関する情報が混ざっていたらexclude）
- ambiguity.isAmbiguousがtrueの場合、candidateMeaningsのうち最も可能性の高い意味
  （通常はentityNameが示す意味）に合うものだけをuseにする
- 今または近い未来に関する情報か（timeIntentがhistoricalでない限り、大きく古い情報は基本的にexclude）
- 終了済みのイベント・過去の放送済み番組出演のような、既に価値が薄れた情報でないか
- 公式情報または信頼できる情報源か（ゴシップ・噂・出典不明の低品質なまとめ記事はexclude）
- 単なる検索ヒットではなく、読む価値がある具体的な内容を持っているか（タイトルだけで中身が
  ほぼ分からないものはthin_contentとしてexclude）
- 他のクラスタと実質的に同じ話題を重複して扱っていないか（重複していればexclude）

イベント・チケット系のページを判定する際は、特に以下を守ってください。
- 「公式」「チケット」「イベント」というsource/channelのラベルだけでuseにしない。中身に
  具体的な公演日・会場・受付期間・チケット販売情報・イベント名のいずれかが確認できるかを見る
- これらの具体情報が1つも確認できない場合（空のイベントページ・「予定はありません」等の
  ページ）は、thin_contentまたはnot_user_intentとしてhold/excludeにする。useにしない
- 事前チェック（下記クラスタ一覧の「事前チェック」欄）で「内容が薄い可能性」と指摘されている
  場合は、その指摘を重視し、具体的な反証（実際に日程・会場等が書かれている）がない限り
  useにしない

現在の活動が少ない人物・グループ等のトピックでは、以下も考慮してください。
- 空の最新情報ページを無理にuseにするより、内容が具体的な過去の共演・インタビュー・
  代表的な功績・逸話・アーカイブ映像などの関連情報の方が、ユーザーにとって価値が高い場合がある
- ただし、過去の情報を「最新の活動」であるかのように扱ってはいけない（judgement自体は
  内容の価値で判断してよいが、reasonに古い情報であることが分かれば書き添える）

topicKind（トピック種別）に応じて、以下も考慮してください。
- seasonal_topic（季節型。例:「旬な果物」）: 今の季節・時期に合っている情報かを重視する。
  違う季節・時期の情報（例: 冬に夏の話題）はtoo_oldまたはnot_user_intentとしてhold/excludeにする
- recommendation_topic（おすすめ・比較型）: 広告色が強いだけで根拠が薄いランキング・比較記事、
  ステルスマーケティングらしき内容はlow_credibilityとしてhold/excludeに寄せる
- theme_topic（横断的テーマ）: トピック名の単語を含むだけの記事ではなく、
  userIntentSummary・informationNeedsに実際に合う内容かどうかを重視する。
  「ラジオ番組」のように特定メディア（ラジオ）を指すトピックで、実際にはテレビ番組表・
  テレビ局の新番組案内など別メディア（テレビ）の内容だった場合は、「改編」等の語句が
  共通していてもnot_user_intentとしてexcludeにする。同様に、辞書・百科事典サイトの
  用語解説（「改編とは」等）は情報源として不適切なためlow_credibilityでexcludeにする
- local_discovery_topic（地域探索型）: 対象地域に実際に合致しているか、既に閉店・終了した
  情報でないかを確認する。informationTypesにopening（開店）・opening_soon（開店予定）が
  含まれる場合は特に厳しく見て、以下をすべて満たさない候補はuseにせずhold/excludeにする
  （実機検証で「地域のグルメ情報サイトの店舗一覧ページ」「行政の補助金制度案内」等、
  特定の新規開店店舗を指していない一般的な内容がuseと判定されてしまう事例が見つかったため）。
  - 具体的な店舗名が明記されている（「〇〇エリアの飲食店一覧」のような集合的な内容ではない）
  - 開店日または開店予定時期が分かる（不明な場合はopening_soonではなくother等へ回す）
  - 所在地（少なくとも地域名・最寄り駅等）が分かる
  複数店舗を横断的に紹介するグルメサイト・クーポンサイトのトップページ・行政の助成金制度
  紹介ページ等は、たとえ地域や飲食店に言及していても、この基準ではuseにしない
- learning_topic（学習型）: audienceLevelに合っているか（初心者向けなのに高度すぎる、
  逆に上級者向けなのに基礎すぎる等はnot_user_intentとしてhold寄りにする）

33ジャンル分類（primaryGenreId）に応じた収集元・情報源の信頼性判断が補足情報にある場合、
それも踏まえてlow_credibility判定の基準を調整してください（例: 公式確認必須のジャンルでは
公式情報源以外をより厳しく見る、季節依存の高いジャンルでは季節ズレをtoo_oldとして扱う）。

判定基準:
- use: 上記の観点で問題がなく、ユーザーに見せる価値がある
- hold: 判断に迷う、あるいは情報としては悪くないが優先度が低い（今回は表示しないが、
  除外するほどでもない）。判断に迷う場合は無理にuse/excludeを選ばず、必ずholdにすること
- exclude: 上記いずれかの理由でユーザーに見せるべきでない。この場合はexcludeReasonを
  必ず指定する

特に重要: timeIntentが"historical"の場合は、古い情報を理由にexcludeしないでください。
timeIntentが"current_or_future"や"recent"の場合は、todayDateから見て大きく古い情報
（数か月以上前で、今後に関係しない話題）は積極的にtoo_oldとしてexcludeしてください。
publishedAtが不明な情報は、古さだけを理由にexcludeしないでください（他の観点で判断する）。

出力形式の厳守事項（重要）:
- 必ずJSONのみを返す。JSON以外の説明文・前置き・後書きは一切書かない
- Markdownのコードブロック（\`\`\`）は使わない
- トップレベルは必ずオブジェクトにし、resultsという配列プロパティを持たせる
- 渡された全てのclusterIndexについて、resultsに1件ずつ結果を含める（漏れなく）
- reasonは1文・40文字程度の簡潔な説明にする。長文の説明・箇条書きは書かない
- excludeReasonは指定されたenum値のみを使う（それ以外の文字列は書かない）

judgementの候補: ${VETTING_JUDGEMENTS.join(", ")}
excludeReasonの候補: ${VETTING_EXCLUDE_REASONS.join(", ")}`;

function truncateForAi(text: string, maxLength: number): string {
  if (!text) return text;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

function buildUserMessage(
  input: Omit<VetResearchCandidatesInput, "clusters">,
  clusters: VettingClusterInput[],
): string {
  const understanding = input.classification.understanding;
  const lines = [
    `トピック名: ${input.topicName}`,
    `topicKind（トピック種別、必ず考慮すること）: ${understanding.topicKind}`,
    `今日の日付: ${input.todayDate}`,
    `freshnessProfile: ${input.classification.freshnessProfile}（${input.classification.freshnessReason}）`,
    `timeIntent: ${input.classification.timeIntent}（${input.classification.timeIntentReason}）`,
    `ユーザーの意図（最重要）: ${understanding.userIntentSummary}`,
    `対象エンティティ: ${understanding.entityName ?? "(特定の対象なし)"}${understanding.entityType ? `（${understanding.entityType}）` : ""}`,
    `求めている情報の種類: ${understanding.informationNeeds.join(", ") || "(指定なし)"}`,
    `優先すべき観点（prioritySignals）: ${understanding.prioritySignals.join(", ") || "(なし)"}`,
    `除外すべき方向性（negativeSignals）: ${understanding.negativeSignals.join(", ") || "(なし)"}`,
  ];

  if (understanding.ambiguity.isAmbiguous) {
    lines.push(
      `曖昧性: このトピック名には複数の意味があり得る（${understanding.ambiguity.candidateMeanings.join(" / ")}）。理由: ${understanding.ambiguity.reason ?? "不明"}。` +
        `${understanding.entityName ?? input.topicName}としての意味に合うものだけをuseにすること`,
    );
  }

  if (input.researchPlan) {
    const genreConfig = getGenreConfig(input.researchPlan.primaryGenreId);
    if (genreConfig) {
      lines.push(
        `33ジャンル分類: ${genreConfig.displayName}（デフォルトリスクレベル: ${genreConfig.defaultRiskLevel}、公式確認必須: ${genreConfig.officialVerificationRequired ? "はい" : "いいえ"}）`,
      );
    }
    lines.push(`リサーチ方針（primaryGoal）: ${input.researchPlan.primaryGoal}`);
    if (input.researchPlan.mustExcludeSignals.length > 0) {
      lines.push(
        `リサーチ方針が指定する除外語句（該当すればexclude）: ${input.researchPlan.mustExcludeSignals.join(", ")}`,
      );
    }
    if (input.researchPlan.notesForVetting) {
      lines.push(`リサーチ方針からの精査メモ: ${input.researchPlan.notesForVetting}`);
    }
  }

  lines.push("", "精査対象のクラスタ一覧:");

  clusters.forEach((cluster) => {
    const thinSignal = computeThinSignal(cluster);
    lines.push(
      `[${cluster.clusterIndex}] タイトル: ${truncateForAi(cluster.representativeTitle, AI_LIMITS.maxTitleLengthForAi)}`,
      `  概要: ${truncateForAi(cluster.representativeSummary, AI_LIMITS.maxSnippetLengthForAi) || "(概要なし)"}`,
      `  情報源: ${cluster.sourceNames.join(", ")}（取得経路: ${
        cluster.origin === "feed_item"
          ? "RSS"
          : cluster.origin === "research_result"
            ? "検索API"
            : "RSS・検索API両方"
      }${cluster.channel ? `・channel: ${cluster.channel}` : ""}）`,
      `  日時: ${cluster.publishedAt ?? "不明"}`,
      `  同一クラスタの件数: ${cluster.itemCount}件`,
    );
    if (thinSignal.isThin) {
      lines.push(`  事前チェック: 内容が薄い可能性があります（${thinSignal.reasons.join("、")}）`);
    }
    lines.push("");
  });

  return lines.join("\n");
}

interface RawVettingResult {
  clusterIndex: number;
  judgement: string;
  reason: string;
  excludeReason?: string;
}

function normalizeJudgement(value: string): VettingJudgement {
  return (VETTING_JUDGEMENTS as string[]).includes(value)
    ? (value as VettingJudgement)
    : "hold";
}

function normalizeExcludeReason(value: string | undefined): VettingExcludeReason | undefined {
  if (!value) return undefined;
  return (VETTING_EXCLUDE_REASONS as string[]).includes(value)
    ? (value as VettingExcludeReason)
    : undefined;
}

function computeThinSignal(cluster: VettingClusterInput) {
  return detectThinOrEmptyResult({
    title: cluster.representativeTitle,
    snippet: cluster.representativeSummary,
    channel: cluster.channel ?? null,
  });
}

// パース失敗・応答取得失敗・呼び出し自体の失敗など、AIによる実際の判定が得られなかった
// 場合の安全側フォールバック。原則「hold」に倒すが、detectThinOrEmptyResultで
// 「空のイベントページ等」と分かっている場合は、AIの判定を待たずexclude（thin_content）に
// 倒す（空リンクを誤ってuse相当のholdバックフィル候補にしないため）。例外は投げない。
function holdResult(cluster: VettingClusterInput, reason: string): VettingResult {
  const thinSignal = computeThinSignal(cluster);
  if (thinSignal.isThin) {
    return {
      clusterIndex: cluster.clusterIndex,
      judgement: "exclude",
      reason: `${reason}（内容が薄いため除外: ${thinSignal.reasons.join("、")}）`,
      excludeReason: "thin_content",
    };
  }
  return { clusterIndex: cluster.clusterIndex, judgement: "hold", reason };
}

async function vetClusterBatch(
  input: Omit<VetResearchCandidatesInput, "clusters">,
  batchClusters: VettingClusterInput[],
  batchIndex: number,
): Promise<{ results: VettingResult[]; failure?: VettingBatchFailure }> {
  let responseText: string;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input, batchClusters) }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    clusterIndex: { type: "integer" },
                    judgement: { type: "string", enum: VETTING_JUDGEMENTS },
                    reason: { type: "string" },
                    excludeReason: { type: "string", enum: VETTING_EXCLUDE_REASONS },
                  },
                  required: ["clusterIndex", "judgement", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["results"],
            additionalProperties: false,
          },
        },
      },
    });

    if (response.stop_reason === "refusal") {
      return {
        results: batchClusters.map((c) => holdResult(c, "AIが精査を拒否したため、安全側でhold")),
        failure: {
          batchIndex,
          batchSize: batchClusters.length,
          errorType: "refusal",
          errorMessage: "AIが精査を拒否しました",
        },
      };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return {
        results: batchClusters.map((c) =>
          holdResult(c, "AIの応答からテキストを取得できなかったため、安全側でhold"),
        ),
        failure: {
          batchIndex,
          batchSize: batchClusters.length,
          errorType: "no_text",
          errorMessage: "AIの応答からテキストを取得できませんでした",
        },
      };
    }

    responseText = textBlock.text;
  } catch (e) {
    const message = isAiCreditOrBillingError(e)
      ? "Anthropic APIの利用上限（クレジット残高不足等）を検知しました"
      : e instanceof Error
        ? e.message
        : "AI精査の呼び出しに失敗しました";
    return {
      results: batchClusters.map((c) => holdResult(c, `AI精査の呼び出しに失敗したため、安全側でhold: ${message}`)),
      failure: { batchIndex, batchSize: batchClusters.length, errorType: "call_failed", errorMessage: message },
    };
  }

  const parsed = parseAiJsonSafely<{ results: RawVettingResult[] }>(responseText);
  if (!parsed.ok) {
    return {
      results: batchClusters.map((c) =>
        holdResult(c, "AI精査のJSONパースに失敗したため、安全側でhold"),
      ),
      failure: {
        batchIndex,
        batchSize: batchClusters.length,
        errorType: "parse_error",
        errorMessage: parsed.errorMessage,
      },
    };
  }

  const byIndex = new Map(parsed.data.results.map((r) => [r.clusterIndex, r]));
  const results = batchClusters.map((c) => {
    const r = byIndex.get(c.clusterIndex);
    if (!r) {
      return holdResult(
        c,
        "AIの応答にこのクラスタの判定が含まれていなかったため、安全側でhold",
      );
    }
    return {
      clusterIndex: c.clusterIndex,
      judgement: normalizeJudgement(r.judgement),
      reason: r.reason,
      excludeReason: normalizeExcludeReason(r.excludeReason),
    };
  });

  return { results };
}

// クラスタをAI_LIMITS.vettingBatchSize件ずつのバッチに分割して精査する。
// 一度に大量のクラスタを渡すとAIの応答が長くなり、JSONが途中で切れて
// パース失敗しやすくなる（実際に64件中62件のクラスタを1回で精査しようとして
// "Unterminated string in JSON"が発生した）。バッチ化により、1バッチの失敗が
// 他バッチへ波及しないようにする（失敗したバッチの候補はholdとして返す。
// 例外は投げない）。
// 決定的除外（仕様書6-2）をAI呼び出しの前段で適用する。日付の新旧判定・
// criticalリスクジャンルでの第3層単独確定禁止は、AIの判断に頼らず機械的に決める方が
// 確実かつ、除外できたクラスタ分だけAI呼び出しのバッチが小さくなりコストも下がる。
function applyDeterministicPreFilters(
  cluster: VettingClusterInput,
  input: Omit<VetResearchCandidatesInput, "clusters">,
): VettingResult | null {
  const timeIntent = input.classification.timeIntent;
  const maxAgeDays = input.researchPlan?.freshnessPolicy.maxAgeDays ?? null;
  const temporal = applyDeterministicTemporalFilter({
    publishedAt: cluster.publishedAt,
    todayDate: input.todayDate,
    timeIntent,
    maxAgeDays,
  });
  if (temporal.excluded) {
    return {
      clusterIndex: cluster.clusterIndex,
      judgement: "exclude",
      reason: temporal.reason ?? "機械的な鮮度判定により除外",
      excludeReason: temporal.excludeReason,
    };
  }

  const genreConfig = input.researchPlan ? getGenreConfig(input.researchPlan.primaryGenreId) : undefined;
  if (genreConfig) {
    // cluster.sourceTierが未指定の場合（feed_item由来のクラスタは常にこちら）のフォールバック計算。
    // 実データ検証で、ここにgenreId/professionalSourceText/topicOfficialUrlを渡していなかったため
    // Verified professional source判定（動物病院等）が一切効かず、正規の獣医師監修記事まで
    // Tier3固定になってしまう不具合が見つかった。research_result由来（enrichResearchResultsWithGenreInfo）
    // と同じ根拠を渡すよう修正する。
    const sourceTier =
      cluster.sourceTier ??
      computeSourceTier(cluster.channel ?? null, cluster.isOfficialSource ?? false, null, {
        topicOfficialUrl: input.classification.officialUrl,
        genreId: input.researchPlan?.primaryGenreId ?? input.classification.understanding.primaryGenreId,
        professionalSourceText: `${cluster.representativeTitle} ${cluster.representativeSummary} ${cluster.sourceNames.join(" ")}`,
      });
    const informationTypes = cluster.informationTypes ?? input.classification.understanding.informationTypes;
    const risk = applyDeterministicRiskFilter({
      genreDefaultRiskLevel: genreConfig.defaultRiskLevel,
      officialVerificationRequired: genreConfig.officialVerificationRequired,
      isOfficialSource: cluster.isOfficialSource ?? false,
      sourceTier,
      informationTypes,
    });
    if (risk.excluded) {
      // excludeReasonが無い場合は「hold相当」の合図（highリスクでTier1不足の場合等）。
      // AIに再判断させず、安全側でholdへ倒す（除外ではなく保留にする）。
      if (!risk.excludeReason) {
        return {
          clusterIndex: cluster.clusterIndex,
          judgement: "hold",
          reason: risk.reason ?? "機械的なリスク判定により保留",
        };
      }
      return {
        clusterIndex: cluster.clusterIndex,
        judgement: "exclude",
        reason: risk.reason ?? "機械的なリスク判定により除外",
        excludeReason: risk.excludeReason,
      };
    }
  }

  return null;
}

export async function vetResearchCandidates(
  input: VetResearchCandidatesInput,
): Promise<VetResearchCandidatesOutput> {
  if (input.clusters.length === 0) {
    return { results: [], batchCount: 0, failedBatchCount: 0, parseErrorCount: 0, failures: [] };
  }

  const { clusters, ...rest } = input;

  const results: VettingResult[] = [];
  const clustersForAi: VettingClusterInput[] = [];
  for (const cluster of clusters) {
    const preFiltered = applyDeterministicPreFilters(cluster, rest);
    if (preFiltered) {
      results.push(preFiltered);
    } else {
      clustersForAi.push(cluster);
    }
  }

  const batchSize = Math.max(1, AI_LIMITS.vettingBatchSize);
  const batches: VettingClusterInput[][] = [];
  for (let i = 0; i < clustersForAi.length; i += batchSize) {
    batches.push(clustersForAi.slice(i, i + batchSize));
  }

  // 各バッチは独立したAnthropic API呼び出しで、他バッチの結果に依存しないため並列実行する
  // （レビュー指摘: 逐次awaitだとバッチ数×1回分のレイテンシがそのまま積み上がっていた）。
  const failures: VettingBatchFailure[] = [];
  const batchOutcomes = await Promise.all(
    batches.map((batch, i) => vetClusterBatch(rest, batch, i)),
  );
  for (const { results: batchResults, failure } of batchOutcomes) {
    results.push(...batchResults);
    if (failure) failures.push(failure);
  }

  return {
    results,
    batchCount: batches.length,
    failedBatchCount: failures.length,
    parseErrorCount: failures.filter((f) => f.errorType === "parse_error").length,
    failures,
  };
}
