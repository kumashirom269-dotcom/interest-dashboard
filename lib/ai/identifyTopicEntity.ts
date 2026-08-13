import Anthropic from "@anthropic-ai/sdk";
import {
  TOPIC_KINDS,
  type CandidateEntity,
  type IdentifiedEntity,
  type IdentificationStatus,
  type RequestedAdditionalInfo,
  type TopicIdentificationResult,
  type TopicKind,
} from "@/lib/topic-identification/types";
import { preliminaryTopicExploration } from "@/lib/topic-identification/preliminaryTopicExploration";

const client = new Anthropic();

const IDENTIFICATION_STATUSES: IdentificationStatus[] = [
  "identified",
  "needs_selection",
  "needs_more_info",
  "not_identifiable",
];

const REQUESTED_ADDITIONAL_INFO_VALUES: RequestedAdditionalInfo[] = [
  "youtube_channel_url",
  "official_site_url",
  "sns_url",
  "alias",
  "activity_genre",
  "description",
];

export interface IdentifyTopicInput {
  name: string;
  description: string;
  keywords: string[];
  // これまでのユーザーからの追加情報（ラウンドごとに1件、古い順）。
  // 初回解析ではundefined/空配列。
  additionalInfoHistory?: string[];
  // 追加情報の中にYouTubeチャンネルURLが検出された場合に、呼び出し元
  // （identifyTopicAction）が組み立てて渡す明示的な文脈。渡された場合、AIは
  // このURLを最重要の識別情報として扱う（システムプロンプト参照）。
  youtubeContext?: string;
}

// このサービスが扱えるトピックの種別は、1つの固有対象を追うentity_topicだけではない。
// 「旬な果物」のように固有対象を持たないテーマ型・季節型トピックも、収集方針さえ
// 定まれば登録できる。identificationStatusは「登録できるかどうか」のゲートであり、
// topicKindは「登録できる場合、どういう種類のトピックとして扱うか」を表す、
// 直交する2つの軸である点に注意（旧バージョンではこの区別が無く、entity_topicとして
// 特定できない入力を一律not_identifiableにしていたため、「旬な果物」のようなテーマ型が
// 登録できなかった）。
const SYSTEM_PROMPT = `あなたは、ユーザーが登録しようとしている関心トピックについて、
「どのような種類のトピックか（topicKind）」と「情報収集を始めてよいか（identificationStatus）」を
判定するアシスタントです。

このサービスでは、対象・テーマが明確になって初めて、情報収集（RSS取得・Web探索・情報源探索）を
開始できます。曖昧なまま情報収集を始めると、無関係な情報や意図と違う情報を集めてしまうため、
慎重に判定してください。

## topicKind（トピックの種別）

- entity_topic: 1つの固有対象（人物・グループ・企業・場所・製品等）を追うトピック。
  例：THE ALFEE、東野圭吾、任天堂、高崎市、ChatGPT、Nintendo Switch 2
- theme_topic: 固有対象ではなく、横断的なテーマを追うトピック。
  例：テレビ番組、健康的な朝食、文房具、吹奏楽コンクール情報
- seasonal_topic: 季節や時期によって内容が変わるトピック。
  例：旬な果物、夏に行きたい旅行先、梅雨の体調管理、冬のイルミネーション
- local_discovery_topic: 地域内の新しいもの・イベント・店舗などを探すトピック。
  例：高崎市の新しい飲食店、群馬の週末イベント、前橋の子ども向けイベント
- recommendation_topic: おすすめ・比較・選び方を扱うトピック。
  例：今おすすめのスイーツ、買ってよかった家電、初心者向けの文房具
- trend_topic: 流行・SNS・話題性を追うトピック。
  例：SNSで話題のレシピ、最近流行っている曲、話題のアニメ
- learning_topic: 学習・入門・勉強方法を扱うトピック。
  例：初心者向けJava学習、簿記2級の勉強法、Web開発の学習ロードマップ
- ambiguous_topic: 複数の意味があり、意味によって収集内容が大きく変わるため、
  ユーザーに選択してもらうべきトピック。例：テレビ、嵐、Java、Apple、サックス、ドラム
  （これはidentificationStatus=needs_selectionの場合の「暫定的な」種別であり、
  ユーザーが候補を選んだ後に確定するtopicKindとしては使わない。各候補（candidateEntities）
  ごとに、その候補を選んだ場合の実際のtopicKindを個別に指定する）

## identificationStatus（登録を許可してよいか）

- identified: 次のいずれかの場合。
  (a) entity_topicとして、1つの固有対象に十分特定できる
      （例：THE ALFEE、任天堂、高崎市、ChatGPT、HIKAKIN、東海オンエア。一般に広く知られている
      固有名詞で他の解釈がほぼ考えられない場合）
  (b) theme_topic / seasonal_topic / local_discovery_topic / recommendation_topic /
      trend_topic / learning_topic のいずれかとして、意味が1つに定まり、
      迷わず情報収集を始められる（例：旬な果物→seasonal_topic、初心者向けJava学習→
      learning_topic、群馬の週末イベント→local_discovery_topic）
  **重要**: 「1つの固有名詞として特定できない」という理由だけではidentifiedを拒否しない。
  テーマとして収集方針が定まるなら、topicKindをtheme_topic等にしてidentifiedにしてよい
- needs_selection: 複数の解釈があり、意味によって収集内容が大きく変わる場合
  （topicKind=ambiguous_topic）。candidateEntitiesに2〜5件の候補を出す。それぞれの候補には
  その意味を選んだ場合の実際のtopicKind・entityType・intentCategory・
  （分かりやすい場合は）suggestedTopicNameを入れる。候補の中に「特定の人物・対象の
  話であればentity_topicとして扱うが、対象名が分からないと特定できない」という
  選択肢がある場合は、その候補のneedsMoreInfoをtrueにし、suggestedQuestionに
  「どの〇〇についてですか？」のような具体的な確認文を入れる
- needs_more_info: entity_topicとしてもテーマとしても、情報収集の方向性を決めるには
  情報が足りない場合。例：YouTuber名が一般的すぎて候補も出せない、入力が短すぎて
  何を集めたいのか全く読み取れない。clarificationQuestionに具体的な質問文、
  requestedAdditionalInfoに優先して欲しい情報の種類を入れる
- not_identifiable: 追加情報をもらっても情報収集の対象として成立しない場合
  （意味不明な入力、実在しないもの、政治的センシティブ・有害な内容など）、または
  複数回確認しても方向性が定まらなかった場合。この場合は登録を許可しない。
  **「固有名詞ではない」という理由だけでnot_identifiableにしてはいけない**
  （そのような入力はtheme_topic等としてidentifiedにできないか先に検討すること）

canProceedToPreferenceSelectionは、identificationStatusが"identified"の場合のみtrueにする。
それ以外は必ずfalseにする。

YouTuber・配信者らしき名前で対象が特定できない場合、requestedAdditionalInfoは
以下の優先順で選ぶ：youtube_channel_url（チャンネルURL）、alias（チャンネルIDやハンドル、
よく使われている別名）、description（正式なチャンネル名や活動内容の説明）、activity_genre（活動ジャンル）、
official_site_url・sns_url（公式サイトやSNS）。
clarificationQuestionは、ユーザーがそのまま読んで答えられる自然な日本語の質問文にする
（例:「この名前だけではYouTubeチャンネルを特定できませんでした。チャンネルURL、または正式なチャンネル名を教えてください。」）。

normalizedTopicNameは、対象・テーマが特定できた場合（identified）に、その一般的な正式名称を
入れる（テーマ型の場合は「旬な果物」→「旬の果物」のように整理した言い方でよい）。
特定できていない場合はnullにする。

identifiedEntityは、identificationStatusが"identified"の場合のみ値を入れ、それ以外はnullにする。
theme_topic等の場合、nameには固有対象名の代わりに正規化したテーマ名を入れ、entityTypeには
"theme"のような短い説明的ラベルを自由に入れてよい（既存のTOPIC_ENTITY_TYPES enumに
縛られない）。canonicalUrl/officialUrl/youtubeChannelUrlは、entity_topicで確実に分かる場合のみ
入れ、不確かな場合や該当しない場合は絶対に架空のURLを作らずnull（または省略）にする。
candidateEntitiesは、needs_selectionの場合のみ2〜5件程度入れ、それ以外は空配列にする。
confidenceは0〜1の数値。

ユーザーは、これまでの確認ラウンドで追加情報を入力している場合があります。
その場合は、元の入力に加えて追加情報も踏まえて再判定してください。
すでに2回程度確認しても特定できていない場合は、無理に3回目の質問を作らず、
not_identifiableとし、より確実なURL等の入力を促すreasonにしてください。

YouTubeチャンネルURLが与えられている場合、そのURLを最重要の識別情報として扱ってください。
入力名が短い、曖昧、一般語に見える場合でも、URLの存在によりYouTubeチャンネルまたは
クリエイターとして扱ってください。この場合、identificationStatusをneeds_selectionや
not_identifiableにせず、identifiedにしてください（チャンネル名が分からない場合でも、
handle名や取得できたチャンネル名をidentifiedEntity.nameに使い、entityTypeは
"youtube_channel"、topicKindは"entity_topic"にし、youtubeChannelUrlに必ずそのURLを
入れてください）。

事前ヒント（preliminaryTopicExploration、システム側のルールベース判定）が渡されている場合、
それはネットワークアクセスを伴わない簡易的な参考情報であり、最終判断はあなたが行いますが、
矛盾がなければ活用してください。

必ずJSONのみを返してください（説明文やコードブロックの記法は不要）。日本語で生成してください
（identificationStatus・topicKind・entityType・requestedAdditionalInfoの値自体は指定の識別子を使う）。

identificationStatusの候補: ${IDENTIFICATION_STATUSES.join(", ")}
topicKindの候補: ${TOPIC_KINDS.join(", ")}
requestedAdditionalInfoの候補: ${REQUESTED_ADDITIONAL_INFO_VALUES.join(", ")}`;

function buildUserMessage(input: IdentifyTopicInput): string {
  const lines = [
    `トピック名（ユーザーの入力）: ${input.name}`,
    `説明: ${input.description || "(説明なし)"}`,
    `キーワード: ${input.keywords.length > 0 ? input.keywords.join(", ") : "(なし)"}`,
  ];

  const history = input.additionalInfoHistory ?? [];
  if (history.length > 0) {
    lines.push("");
    lines.push("これまでにユーザーが入力した追加情報:");
    history.forEach((info, index) => {
      lines.push(`  ${index + 1}回目: ${info}`);
    });
  }

  if (input.youtubeContext) {
    lines.push("");
    lines.push(input.youtubeContext);
  }

  // ネットワークアクセス・追加のAI呼び出しを伴わない、軽量なルールベース事前チェック。
  // 「旬」「初心者向け」「〇〇市の新規」のような表現から、テーマ型・季節型・地域探索型・
  // 学習型らしさをヒントとして渡すだけに留める（本格的なWeb検索連携は今回のスコープ外）。
  const hint = preliminaryTopicExploration(input.name);
  if (hint.hint !== "unknown") {
    lines.push("", `事前ヒント（ルールベース、参考情報）: ${hint.reason}`);
  }

  return lines.join("\n");
}

interface RawIdentifiedEntity {
  name: string;
  entityType: string;
  description: string;
  canonicalUrl?: string | null;
  officialUrl?: string | null;
  youtubeChannelUrl?: string | null;
  confidence: number;
  topicKind: string;
}

interface RawCandidateEntity {
  name: string;
  entityType: string;
  description: string;
  officialUrl?: string | null;
  youtubeChannelUrl?: string | null;
  confidence: number;
  topicKind: string;
  intentCategory?: string | null;
  suggestedTopicName?: string | null;
  needsMoreInfo?: boolean;
  suggestedQuestion?: string | null;
}

interface RawIdentificationResult {
  inputText: string;
  normalizedTopicName: string | null;
  identificationStatus: string;
  identifiedEntity: RawIdentifiedEntity | null;
  candidateEntities: RawCandidateEntity[];
  clarificationQuestion: string | null;
  requestedAdditionalInfo: string[];
  canProceedToPreferenceSelection: boolean;
  reason: string;
}

function normalizeStatus(value: string): IdentificationStatus {
  return (IDENTIFICATION_STATUSES as string[]).includes(value)
    ? (value as IdentificationStatus)
    : "not_identifiable";
}

function normalizeTopicKind(value: string | undefined | null): TopicKind {
  return value && (TOPIC_KINDS as string[]).includes(value)
    ? (value as TopicKind)
    : "unknown";
}

function normalizeRequestedInfo(values: string[]): RequestedAdditionalInfo[] {
  return values.filter((v): v is RequestedAdditionalInfo =>
    (REQUESTED_ADDITIONAL_INFO_VALUES as string[]).includes(v),
  );
}

function normalizeIdentifiedEntity(
  raw: RawIdentifiedEntity | null,
): IdentifiedEntity | null {
  if (!raw) return null;
  return {
    name: raw.name,
    entityType: raw.entityType,
    description: raw.description,
    canonicalUrl: raw.canonicalUrl ?? null,
    officialUrl: raw.officialUrl ?? null,
    youtubeChannelUrl: raw.youtubeChannelUrl ?? null,
    confidence: Math.min(1, Math.max(0, raw.confidence)),
    topicKind: normalizeTopicKind(raw.topicKind),
  };
}

function normalizeCandidateEntities(raw: RawCandidateEntity[]): CandidateEntity[] {
  return raw.map((c) => ({
    name: c.name,
    entityType: c.entityType,
    description: c.description,
    officialUrl: c.officialUrl ?? null,
    youtubeChannelUrl: c.youtubeChannelUrl ?? null,
    confidence: Math.min(1, Math.max(0, c.confidence)),
    topicKind: normalizeTopicKind(c.topicKind),
    intentCategory: c.intentCategory ?? undefined,
    suggestedTopicName: c.suggestedTopicName ?? undefined,
    needsMoreInfo: c.needsMoreInfo ?? false,
    suggestedQuestion: c.suggestedQuestion ?? undefined,
  }));
}

export async function identifyTopicEntity(
  input: IdentifyTopicInput,
): Promise<TopicIdentificationResult> {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            inputText: { type: "string" },
            normalizedTopicName: { type: ["string", "null"] },
            identificationStatus: { type: "string", enum: IDENTIFICATION_STATUSES },
            identifiedEntity: {
              type: ["object", "null"],
              properties: {
                name: { type: "string" },
                entityType: { type: "string" },
                description: { type: "string" },
                canonicalUrl: { type: ["string", "null"] },
                officialUrl: { type: ["string", "null"] },
                youtubeChannelUrl: { type: ["string", "null"] },
                confidence: { type: "number" },
                topicKind: { type: "string", enum: TOPIC_KINDS },
              },
              required: ["name", "entityType", "description", "confidence", "topicKind"],
              additionalProperties: false,
            },
            candidateEntities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  entityType: { type: "string" },
                  description: { type: "string" },
                  officialUrl: { type: ["string", "null"] },
                  youtubeChannelUrl: { type: ["string", "null"] },
                  confidence: { type: "number" },
                  topicKind: { type: "string", enum: TOPIC_KINDS },
                  intentCategory: { type: ["string", "null"] },
                  suggestedTopicName: { type: ["string", "null"] },
                  needsMoreInfo: { type: "boolean" },
                  suggestedQuestion: { type: ["string", "null"] },
                },
                required: [
                  "name",
                  "entityType",
                  "description",
                  "confidence",
                  "topicKind",
                  "needsMoreInfo",
                ],
                additionalProperties: false,
              },
            },
            clarificationQuestion: { type: ["string", "null"] },
            requestedAdditionalInfo: {
              type: "array",
              items: { type: "string", enum: REQUESTED_ADDITIONAL_INFO_VALUES },
            },
            canProceedToPreferenceSelection: { type: "boolean" },
            reason: { type: "string" },
          },
          required: [
            "inputText",
            "normalizedTopicName",
            "identificationStatus",
            "identifiedEntity",
            "candidateEntities",
            "clarificationQuestion",
            "requestedAdditionalInfo",
            "canProceedToPreferenceSelection",
            "reason",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AIが対象特定の解析を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  const parsed = JSON.parse(textBlock.text) as RawIdentificationResult;
  const identificationStatus = normalizeStatus(parsed.identificationStatus);
  const identifiedEntity =
    identificationStatus === "identified"
      ? normalizeIdentifiedEntity(parsed.identifiedEntity)
      : null;

  return {
    inputText: parsed.inputText,
    normalizedTopicName: parsed.normalizedTopicName,
    identificationStatus,
    identifiedEntity,
    candidateEntities:
      identificationStatus === "needs_selection"
        ? normalizeCandidateEntities(parsed.candidateEntities)
        : [],
    clarificationQuestion: parsed.clarificationQuestion,
    requestedAdditionalInfo: normalizeRequestedInfo(parsed.requestedAdditionalInfo),
    // identifiedEntityが実際に得られた場合のみtrueにする
    // （AIがcanProceedToPreferenceSelection=trueを返してもidentifiedEntityがnullなら信用しない）。
    canProceedToPreferenceSelection:
      identificationStatus === "identified" && identifiedEntity !== null,
    reason: parsed.reason,
  };
}
