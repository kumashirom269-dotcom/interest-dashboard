import Anthropic from "@anthropic-ai/sdk";
import type { TopicClassification } from "@/lib/topic-classification/types";
import {
  DESIRED_CONTENT_TYPE_LABELS,
  DISPLAY_TONE_LABELS,
  EXCLUDED_TENDENCY_LABELS,
  TARGET_LEVEL_LABELS,
  type DesiredContentType,
  type DisplayTone,
  type ExcludedTendency,
  type TargetLevel,
  type TopicPreferenceSettings,
} from "@/lib/topic-preference-settings/types";
import type { SourceType } from "@/types/domain";

const SOURCE_TYPES: SourceType[] = [
  "official_blog",
  "news_site",
  "rss",
  "tech_blog",
  "local_event_site",
  "youtube_channel",
  "research_site",
  "other",
];

// sourcesテーブルには存在しない項目（confidence/search_query/expected_content）は、
// 現時点ではDBカラムを追加せず、reasonへ自然文として折り込む。
// 将来sourcesにこれらのカラムを追加する場合は、AIからの生データをそのまま保存できる。
export interface GeneratedSourceCandidate {
  name: string;
  url: string;
  rss_url: string | null;
  source_type: SourceType;
  reason: string;
  priority: number;
  // AIがこのURL・情報源が実在すると判断した自信度（0〜1）。
  // 品質管理カラム（needs_review等）の自動判定に使う。
  confidence: number;
}

interface TopicInput {
  name: string;
  description: string;
  keywords: string[];
  // 保存済みのAI分類結果があれば渡す。まだ未分類のトピックではundefinedになる。
  classification?: TopicClassification;
  // ユーザーが指定した好み設定があれば渡す。未設定のトピックではundefinedになる。
  preferences?: TopicPreferenceSettings;
}

const client = new Anthropic();

const TARGET_LEVEL_GUIDANCE: Record<TargetLevel, string> = {
  beginner: "初心者向けの解説、やさしい記事、入門情報を優先する。",
  intermediate: "実用的な解説、比較記事、活用事例を優先する。",
  advanced: "公式ドキュメント、専門記事、技術ブログなど一次情報に近いものを優先する。",
};

const DESIRED_CONTENT_TYPE_GUIDANCE: Record<DesiredContentType, string> = {
  news: "ニュースサイト、公式発表、プレスリリースを重視する。",
  tutorial: "解説記事、使い方、入門記事を重視する。",
  trend: "SNSで話題になっている情報、トレンド、ランキング系の情報を重視する（本格的なSNS連携は将来対応）。",
  youtube: "YouTubeチャンネルや動画コンテンツの情報源を重視する。",
  sns: "X・Instagram・TikTokなどSNSでの話題を重視する（本格連携は将来対応、現時点ではsource_typeやreasonへの反映に留める）。",
  official: "公式サイト、公式ブログ、公式ドキュメントを重視する。",
  personal_story: "体験談、レビュー、note、個人ブログなどを重視する。",
  idea: "アイデア、考察、まとめ、解説系のコンテンツを重視する。",
};

const DISPLAY_TONE_GUIDANCE: Record<DisplayTone, string> = {
  easy: "やさしく分かりやすい情報源を優先する。",
  practical: "実用的で、すぐに使える情報源を優先する。",
  deep: "深掘りされた、専門性の高い情報源を優先する。",
  casual: "気軽に読める、エンタメ性のある情報源を優先する。",
};

const EXCLUDED_TENDENCY_GUIDANCE: Record<ExcludedTendency, string> = {
  too_technical: "専門的すぎる情報源は避ける。",
  too_old: "更新が古い、動きが止まっている情報源は避ける。",
  too_promotional: "広告色・宣伝色の強い情報源は避ける。",
};

function buildClassificationSection(classification?: TopicClassification): string {
  if (!classification) return "";

  return `

AIによる分類結果（参考情報）:
- entityType: ${classification.entityType}
- 大カテゴリ: ${classification.parentCategory}
- 中カテゴリ: ${classification.subCategory}
- 詳細カテゴリ: ${classification.detailCategory}
- 概要: ${classification.summary}
- 追跡したい情報: ${classification.intentTags.join(", ")}
- 検索キーワード候補: ${classification.searchKeywords.join(", ")}
- おすすめ情報源タイプ: ${classification.recommendedSourceTypes.join(", ")}
- AIの分類信頼度: ${Math.round(classification.confidence * 100)}%`;
}

function buildAmbiguitySection(classification?: TopicClassification): string {
  if (!classification?.needsUserConfirmation) return "";

  const candidateLines =
    classification.candidateEntities.length > 0
      ? classification.candidateEntities
          .map(
            (c, i) =>
              `  ${i + 1}. ${c.label}（${c.parentCategory} / ${c.subCategory}）: ${c.description}`,
          )
          .join("\n")
      : "";

  return `

【注意】このトピックはAIの分類が曖昧で、ユーザーへの確認が必要な状態です（needsUserConfirmation=true）。
${classification.ambiguityReason ? `曖昧な理由: ${classification.ambiguityReason}\n` : ""}${
    candidateLines
      ? `考えられる解釈候補:\n${candidateLines}\n`
      : ""
  }
候補がまだ確定していないため、以下の方針で提案してください。
- どの解釈でも役立つ、比較的安全で一般的な情報源（公式サイト、信頼できるニュースサイトなど）を中心に提案する
- 特定の解釈だけに強く依存する情報源（例: 人物なら特定の私生活情報など）は避けるか、reasonに「〇〇（候補名）を想定した場合の情報源」のように、どの候補を想定しているかを明記する
- 通常より少なめの候補数にする`;
}

function buildPreferencesSection(preferences?: TopicPreferenceSettings): string {
  if (!preferences) return "";

  const lines: string[] = [];
  lines.push(`- 対象レベル: ${TARGET_LEVEL_LABELS[preferences.targetLevel]}（${TARGET_LEVEL_GUIDANCE[preferences.targetLevel]}）`);

  if (preferences.desiredContentTypes.length > 0) {
    const guidance = preferences.desiredContentTypes
      .map((t) => `${DESIRED_CONTENT_TYPE_LABELS[t]}: ${DESIRED_CONTENT_TYPE_GUIDANCE[t]}`)
      .join(" / ");
    lines.push(`- 欲しい情報の種類: ${guidance}`);
  }

  lines.push(`- 表示トーン: ${DISPLAY_TONE_LABELS[preferences.displayTone]}（${DISPLAY_TONE_GUIDANCE[preferences.displayTone]}）`);

  if (preferences.excludedTendencies.length > 0) {
    const guidance = preferences.excludedTendencies
      .map((t) => `${EXCLUDED_TENDENCY_LABELS[t]}: ${EXCLUDED_TENDENCY_GUIDANCE[t]}`)
      .join(" / ");
    lines.push(`- 除外したい傾向: ${guidance}`);
  }

  if (preferences.userFocus) {
    lines.push(`- ユーザーが特に知りたいこと（強く考慮する）: ${preferences.userFocus}`);
  }

  if (preferences.supplementaryNotes) {
    lines.push(`- 補足説明（強く考慮する）: ${preferences.supplementaryNotes}`);
  }

  return `

ユーザーの好み設定（参考情報）:
${lines.join("\n")}`;
}

export async function generateSourceCandidatesWithAI(
  topic: TopicInput,
): Promise<GeneratedSourceCandidate[]> {
  const isAmbiguous = topic.classification?.needsUserConfirmation ?? false;
  const candidateCountInstruction = isAmbiguous
    ? "2〜3件（曖昧なトピックのため通常より少なめ）"
    : "3〜5件";

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system:
      "あなたはユーザーの興味トピックに基づいて、情報収集に適したWebサイトやRSSフィードの候補を提案するアシスタントです。実在する可能性が高い、信頼できる情報源を提案してください。架空のURLを作らないでください。URLの実在に自信が持てない場合は、urlを空文字列にしてください。" +
      "特にYouTubeチャンネルのrss_urlは`https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxxxxxxxxxxxxxxxxxxxx`の形式が必要ですが、実在するchannel_id（UCで始まる22文字の英数字）を確実に知っている場合以外は、絶対に架空のchannel_idを作らず、rss_urlをnullにしてください。存在するかどうか不確かな数字・IDを推測で埋めるのは禁止です。",
    messages: [
      {
        role: "user",
        content: `以下のトピックに関連する情報収集元の候補を${candidateCountInstruction}提案してください。

トピック名: ${topic.name}
説明: ${topic.description || "(説明なし)"}
キーワード: ${topic.keywords.length > 0 ? topic.keywords.join(", ") : "(なし)"}${buildClassificationSection(
          topic.classification,
        )}${buildAmbiguitySection(topic.classification)}${buildPreferencesSection(topic.preferences)}

各候補について、name/url/rss_url/source_type/reason/priorityに加えて、
confidence（このURLが実在する自信度、0〜1）・search_query（この情報源を今後Web調査する場合に使う検索語）・
expected_content（この情報源からどんな内容が得られると期待されるか）も出力してください。
confidence/search_query/expected_contentは、reasonの文章に自然な形で含めてください（例:「〇〇（想定内容の説明）。検索キーワード: △△」）。`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            candidates: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "情報源の名称" },
                  url: {
                    type: "string",
                    description:
                      "情報源のトップページURL。実在に自信が持てない場合は空文字列",
                  },
                  rss_url: {
                    type: ["string", "null"],
                    description: "RSSフィードのURL。不明な場合はnull",
                  },
                  source_type: { type: "string", enum: SOURCE_TYPES },
                  reason: {
                    type: "string",
                    description:
                      "このトピックに関連すると判断した理由。想定される内容や検索キーワードも自然な文章で含める",
                  },
                  priority: {
                    type: "integer",
                    description: "おすすめ度（1〜5、5が最も高い）",
                  },
                  confidence: {
                    type: "number",
                    description: "このURL・情報源が実在する自信度（0〜1）",
                  },
                  search_query: {
                    type: "string",
                    description: "将来Web調査する場合に使う検索キーワード",
                  },
                  expected_content: {
                    type: "string",
                    description: "この情報源から得られると期待される内容",
                  },
                },
                required: [
                  "name",
                  "url",
                  "rss_url",
                  "source_type",
                  "reason",
                  "priority",
                  "confidence",
                  "search_query",
                  "expected_content",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["candidates"],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AIが収集元候補の生成を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  interface RawCandidate {
    name: string;
    url: string;
    rss_url: string | null;
    source_type: SourceType;
    reason: string;
    priority: number;
    confidence: number;
    search_query: string;
    expected_content: string;
  }

  const parsed = JSON.parse(textBlock.text) as { candidates: RawCandidate[] };

  return parsed.candidates.map((c) => ({
    name: c.name,
    // sources.urlはNOT NULL制約のため、AIが実在に自信を持てなかった場合は空文字列にする
    url: c.url ?? "",
    rss_url: c.rss_url,
    source_type: c.source_type,
    reason: c.reason,
    priority: Math.min(5, Math.max(1, Math.round(c.priority))),
    confidence: Math.min(1, Math.max(0, c.confidence)),
  }));
}
