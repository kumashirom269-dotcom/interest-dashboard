import Anthropic from "@anthropic-ai/sdk";
import { INFORMATION_TYPES, type InformationType } from "@/lib/recommendation-cards/types";
import type { TopicClassification, TopicUnderstanding } from "@/lib/topic-classification/types";
import type { ResearchPlan } from "@/lib/research/types";
import { AI_LIMITS } from "@/lib/config/aiLimits";
import { getGenreConfig } from "@/lib/genres/genreConfigs";
import { parseAiJsonSafely } from "./parseAiJsonSafely";

const client = new Anthropic();

export interface RecommendationCardArticleInput {
  title: string;
  summary: string;
  sourceName: string;
  publishedAt: string | null;
  url: string;
  // 追加の手がかり情報（あれば渡す。無い場合はundefined/nullで構わない）。
  // AIが「公式発表かニュース報道か」「検索での注目度」を判断する材料にする。
  sourceDomain?: string | null;
  rankingPosition?: number | null;
  origin?: "feed_item" | "research_result";
  // evaluateResearchCoverageによる不足判断を受けた補助検索（探索範囲拡張）で
  // 見つかった記事かどうか。trueの場合、最新情報ではなく過去・関連情報である
  // 可能性が高いことをAIに伝える（generatedTitleを「最新情報」のように書かせないため）。
  isFollowUp?: boolean;
}

export interface RecommendationCardInput {
  topicName: string;
  classification?: TopicClassification;
  // AIが立てたリサーチ方針（generateResearchPlan）。渡された場合、primaryGoal・
  // expectedResultTypesをカードの重視ポイント判断の追加材料として使う。
  researchPlan?: ResearchPlan;
  articles: RecommendationCardArticleInput[];
}

export interface GeneratedRecommendationCard {
  generatedTitle: string;
  generatedSummary: string;
  displayReason: string;
  informationType: InformationType;
}

const SYSTEM_PROMPT = `あなたは、ユーザーが登録した関心トピックに関連する記事・検索結果をもとに、
マイページに表示する「おすすめ情報カード」のタイトルと本文を生成するアシスタントです。

このカードは、単に元記事へ誘導するためのリンク一覧ではありません。
ユーザーがこのカードの本文を読んだ時点で、
- 何が起きたのか
- いつの話なのか
- 誰・何に関する話なのか
- どこが重要なのか
- 自分に関係ある情報なのか
がある程度わかる状態を目指してください。元記事リンクは「もっと詳しく確認したい場合の補足」です。

## 絶対に守ること（事実の扱い）
- 提供された記事情報（タイトル・snippet・情報源・日付等）に書かれていない事実を追加・推測・捏造しない
- 日付・会場・番組名・人名・商品名などの具体情報は、提供された情報に実際に含まれている場合のみ書く
- 具体情報が提供されていない場合は、無理に作らず「詳細は元記事で確認できます」といった曖昧な書き方に留める
  （ただし、それだけで終わらせず、分かっている範囲の情報は書く）
- 情報源の性質（公式発表・ニュース報道・SNSでの話題等）が推測できる場合は、断定せず「〜と報じられています」
  「公式が発表しました」のように示す。sourceDomain・sourceName・originから公式サイトらしいと判断できる
  場合は「公式情報によると」のように書いてよい

## generatedTitleの方針（絶対にやってはいけないこと: 「〇〇の情報が確認できます」のような説明だけのタイトル）
- 良い例:「THE ALFEE、2026年春ツアーの日程を発表。4月から全国公演へ」
- 良い例:「渋谷スクランブルスクエアに『SACYA』2号店がオープン、期間限定メニューも」
- 悪い例:「THE ALFEE のライブ情報が確認できます」
- 誰の話か・何が起きたか・可能なら いつの話か を、タイトルの中に具体的に書く
- ユーザーが登録したトピックとの関係が伝わること（トピック名を機械的に文頭へ置く必要はない。
  固有名詞・場所・出来事から自然に伝わるなら、それで十分）
- 一覧・カード表示で読みやすいよう、目安として全角20〜40文字程度に収める
  （収まらない場合は、最も重要な1つの事実に絞って短くする）
- 元記事の見出しをそのままコピーしない。単なる言い換えでもなく、複数の記事情報から要点を再構成する
- 過度に煽らない。誇張しない。事実にない内容を足さない。「確定」「炎上」「必見」などを安易に使わない
- ただし平板になりすぎないよう、提供された情報の中で最も具体的・固有な事実
  （店名・数値・日付・「〇号店」「初の」等の具体的な変化点）を積極的にタイトルへ拾う
- 情報源の確度が低い場合は断定しない（「〜の可能性」「〜として報じられています」等）

## generatedSummaryの方針（絶対にやってはいけないこと: 「確認できます」「紹介されています」「詳細はこちら」だけで終わる文章）
- 元記事の内容を要約するのではなく、提供された情報から分かる具体的な事実を本文に直接書く
  （例:「4月から全国各地で公演が予定されており、公演日程・会場・チケット受付に関する情報が記事内で
  公開されています。参加を検討している場合は、日程と受付期間を早めに確認しておきたい内容です。」）
- 提供された情報に含まれている場合、以下のような具体情報を積極的に本文へ含める:
  日程・開催期間・会場名・出演番組名・発売日・人名・動画タイトル・チケット受付期間・
  新曲/アルバム/グッズ名など
- ユーザーの関心との関係を最初か最後に一言添える
- ユーザーが次に取れる行動があれば書く（日程を確認する、予約する、詳細を見る等）
- 元記事本文の冒頭をそのままコピーしない
- 複数の記事・検索結果が同じ話題を扱っている場合は、内容を統合して1つのまとまった説明にする
  （「A社によると〜、B社によると〜」のような箇条書き的な羅列ではなく、自然な文章にする）
- 2〜4文程度で、本文だけで内容が分かる分量にする（モバイル画面で一覧表示されるため、
  だらだらと長くしない。1文目で最も重要な事実を伝え、残りで補足する）
- 「元記事で確認できます」「詳細は記事内で」のような『続きを促すだけの一文』は、
  本文全体で多くても1回まで。同じ言い回しを毎回の結びで繰り返さない。書くとしても、
  何を確認すればよいか（日程・受付期間・料金など）を具体的に示す

## 空情報・薄い情報のカード化を絶対に避けること
- 提供された記事情報に、具体的な公演日・会場・受付期間・チケット販売情報・イベント名などの
  実質的な内容が無いにもかかわらず、「公開中」「チェックできる」「販売中」「確認できます」
  のように、あたかも詳しい情報があるかのように書いてはいけない
- 「現在予定はありません」「該当する情報が見つかりませんでした」のような、情報が無いことだけを
  伝えるカードは、原則として作らない。そのような記事情報しか無い場合でも、この関数の
  呼び出し元が事前にvetResearchCandidatesで除外する設計になっているため、通常はここまで
  来ないはずだが、もし空に近い情報しか渡されなかった場合は、無理に具体性を捏造せず、
  分かっている範囲だけを正直に書く（「詳しい公演内容は今後の発表を待つ状況です」等）

## 過去情報・関連エピソード・アーカイブ情報の扱い（記事情報に「取得経路: 不足判断による
## 追加検索」と記載されているものが含まれる場合に特に重要）
- これらは最新のイベント・リリース情報が少なかったために、探索範囲を過去の共演・
  インタビュー・代表的な功績・逸話・アーカイブ映像等へ広げて見つかった情報である
- このような情報をカード化する場合、最新の活動であるかのように書いてはいけない。
  「過去映像」「過去の共演」「インタビュー」「名場面」「プロフィール」「代表曲のエピソード」
  「功績」「アーカイブ」のように、過去・関連情報であることが伝わる言葉をタイトルに含める
- 良い例:「過去映像で振り返る、〇〇と△△の共演シーン」「〇〇の人物像が見える、過去
  インタビューの注目発言」
- 悪い例:「〇〇の最新ライブ情報をチェック」（実際にライブ予定が確認できないのにこう書く）
- ただし、具体的な番組名・年・共演者名等は、提供された情報に実際に含まれている場合のみ書く。
  過去情報であっても事実を創作してはいけない

## displayReasonの方針
- なぜこのユーザーにおすすめなのか、一言で説明する
- userIntentSummary（渡されている場合）に沿った理由にする
- 例:「登録トピック『〇〇』に直接関係する出演情報です」「今週チェックしておきたいイベント情報です」

## informationTypeの方針
- 提供された候補から、最も近いものを1つ選ぶ。迷う場合はotherにする

## userIntentSummary・カテゴリ別の重視ポイント（渡されている場合）
- userIntentSummaryに書かれている「ユーザーが本当に求めている情報」を最優先の軸にする。
  記事のタイトルをそのまま要約するのではなく、ユーザーの意図に照らして何が重要かを判断する
- negativeSignalsに該当するような内容（無関係な話題・ゴシップ・別対象の情報等）が記事情報に
  混ざっている場合、それを魅力的に見せない・カードの中心にしない
- category/informationNeedsに応じて、特に以下を重視する:
  - イベント系（event, upcoming_events, detailed_event_info, tickets）: 開催日・場所・
    チケット情報・公式発表の有無を重視する
  - アーティスト系（artist, media_appearance, release_info）: 出演・ライブ・リリース・
    公式発表・イベントを重視する
  - 学習系（learning, technical, beginner_learning, how_to）: 初心者向けか実務向けかを
    明確にする（audienceLevelを参照）。難しすぎる専門的な内容は、その旨が分かるように書く
  - 地域系（local, local_openings）: 場所・地域・新しさ（新規オープン等）を重視する
- audienceLevelがbeginnerの場合、専門用語を避けるか補足する。expertの場合は専門的でよい
- topicKindに応じて、以下も意識する:
  - seasonal_topic: 「今の季節・時期に合っているか」が伝わるように書く（例:「今が旬の」）
  - recommendation_topic: おすすめ・比較の根拠（具体的な理由・データ）があれば書く。
    根拠が無いのに「一番おすすめ」のように断定しない
  - local_discovery_topic: 地域名・場所・新しさ（新規オープン等）を明確に書く
  - learning_topic: audienceLevelに応じた難易度感が伝わるように書く
- 33ジャンル分類（primaryGenreId）ごとの安全・品質ルールが補足情報にある場合、
  それに従うこと（例: ペット・動物ジャンルでは症状・投薬を断定しない、旅行ジャンルでは
  空室・料金・交通情報は表示時点のものである旨を明示する等）

必ずJSONのみを返してください。日本語で生成してください。
informationTypeの候補: ${INFORMATION_TYPES.join(", ")}`;

function buildUnderstandingText(understanding: TopicUnderstanding): string {
  const lines = [
    `\nユーザーの意図（userIntentSummary、最重要）: ${understanding.userIntentSummary}`,
    `トピック種別（topicKind）: ${understanding.topicKind}`,
    `情報カテゴリ: ${understanding.category}`,
  ];
  if (understanding.entityName) {
    lines.push(`対象エンティティ: ${understanding.entityName}${understanding.entityType ? `（${understanding.entityType}）` : ""}`);
  }
  if (understanding.informationNeeds.length > 0) {
    lines.push(`求めている情報の種類: ${understanding.informationNeeds.join(", ")}`);
  }
  if (understanding.prioritySignals.length > 0) {
    lines.push(`重視すべき観点: ${understanding.prioritySignals.join(", ")}`);
  }
  if (understanding.negativeSignals.length > 0) {
    lines.push(`避けるべき方向性: ${understanding.negativeSignals.join(", ")}`);
  }
  if (understanding.audienceLevel !== "unknown") {
    lines.push(`想定読者レベル: ${understanding.audienceLevel}`);
  }
  if (understanding.locationIntent.required) {
    lines.push(`地域性: ${understanding.locationIntent.locationText ?? "地域性が重要"}`);
  }
  const genreConfig = getGenreConfig(understanding.primaryGenreId);
  if (genreConfig) {
    lines.push(`33ジャンル分類: ${genreConfig.displayName}`);
    if (understanding.informationTypes.length > 0) {
      lines.push(`情報タイプ: ${understanding.informationTypes.join(", ")}`);
    }
    lines.push(`ジャンル別の安全・品質ルール: ${genreConfig.qualityAndSafetyRules.join(" / ")}`);
  }
  return lines.join("\n");
}

function truncateForAi(text: string, maxLength: number): string {
  if (!text) return text;
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

// AI呼び出しのコスト（入力トークン量）を抑えるため、title/summaryはAI_LIMITSの上限で
// 切り詰めてから渡す（DB保存用のcardInputs自体はactions.ts側で別途フルテキストを使う）。
function buildArticlesText(articles: RecommendationCardArticleInput[]): string {
  return articles
    .map((a, i) => {
      const lines = [
        `[${i + 1}] タイトル: ${truncateForAi(a.title, AI_LIMITS.maxTitleLengthForAi)}`,
        `概要/snippet: ${truncateForAi(a.summary, AI_LIMITS.maxSnippetLengthForAi) || "(概要なし)"}`,
        `情報源: ${a.sourceName}${a.sourceDomain ? `（${a.sourceDomain}）` : ""}`,
        `日時: ${a.publishedAt ?? "不明"}`,
      ];
      if (a.origin) {
        lines.push(
          `取得経路: ${
            a.isFollowUp
              ? "不足判断による追加検索（最新情報とは限らない。過去・関連情報の可能性）"
              : a.origin === "feed_item"
                ? "RSS購読中の情報源から取得"
                : "検索APIによるリサーチ結果"
          }`,
        );
      }
      if (a.rankingPosition != null) {
        lines.push(`検索結果内の順位: ${a.rankingPosition}位`);
      }
      lines.push(`URL: ${a.url}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export async function generateRecommendationCard(
  input: RecommendationCardInput,
): Promise<GeneratedRecommendationCard> {
  const classificationText = input.classification
    ? `\nトピックの分類: 大カテゴリ=${input.classification.parentCategory} / 中カテゴリ=${input.classification.subCategory} / 詳細=${input.classification.detailCategory}` +
      `\n今日の日付: ${new Date().toISOString().slice(0, 10)}` +
      `\n時期の意図（timeIntent）: ${input.classification.timeIntent}（${input.classification.timeIntentReason}）` +
      `\n※timeIntentがhistorical以外の場合、今日の日付から見て古い出来事を「最新情報」であるかのように書かないこと。` +
      `具体的な日付が分かる場合は、今後の予定か既に終わった話かを区別して書く。` +
      buildUnderstandingText(input.classification.understanding)
    : "";

  const researchPlanText = input.researchPlan
    ? `\nリサーチ方針（primaryGoal）: ${input.researchPlan.primaryGoal}` +
      (input.researchPlan.expectedResultTypes.length > 0
        ? `\nこのリサーチで得たかった情報の種類: ${input.researchPlan.expectedResultTypes.join(", ")}`
        : "")
    : "";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1536,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `登録トピック: ${input.topicName}${classificationText}${researchPlanText}

以下は、このトピックに関連して取得された記事・検索結果です（同じ話題を報じている場合はまとめて渡しています）。
これらの内容だけを根拠にして、おすすめ情報カードを1件生成してください。

${buildArticlesText(input.articles)}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            generatedTitle: { type: "string" },
            generatedSummary: { type: "string" },
            displayReason: { type: "string" },
            informationType: { type: "string", enum: INFORMATION_TYPES },
          },
          required: [
            "generatedTitle",
            "generatedSummary",
            "displayReason",
            "informationType",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AIがおすすめ情報カードの生成を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  // max_tokens到達による途中切れ・markdownコードブロックでの囲み等、生のJSON.parseでは
  // 復帰できない応答にも耐性を持たせる（vetResearchCandidates.tsで実際に発生した障害と
  // 同じ障害モードのため、他のAI呼び出し関数にも同じガードを揃える）。
  const parseResult = parseAiJsonSafely<GeneratedRecommendationCard>(textBlock.text);
  if (!parseResult.ok) {
    throw new Error(
      `AIの応答（おすすめ情報カード）のJSON解析に失敗しました: ${parseResult.errorMessage} / 応答: ${parseResult.responsePreview}`,
    );
  }
  const parsed = parseResult.data;

  return {
    ...parsed,
    informationType: (INFORMATION_TYPES as string[]).includes(
      parsed.informationType,
    )
      ? parsed.informationType
      : "other",
  };
}
