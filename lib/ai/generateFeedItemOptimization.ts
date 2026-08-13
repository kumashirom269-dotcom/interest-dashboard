import Anthropic from "@anthropic-ai/sdk";
import type { TopicClassification } from "@/lib/topic-classification/types";

const client = new Anthropic();

export class AiRefusalError extends Error {}

export interface FeedItemOptimizationInput {
  topicName: string;
  classification?: TopicClassification;
  originalTitle: string;
  originalSummary: string;
}

export interface GeneratedFeedItemOptimization {
  aiTitle: string;
  aiSummary: string;
}

const SYSTEM_PROMPT = `あなたは、ニュース一覧画面に表示する記事のタイトルと要約を最適化するアシスタントです。

## ai_titleの方針
- 元記事タイトルをそのままコピーしない
- ユーザーが登録したトピックとの関係が分かるようにする
- クリックしたくなる表現にするが、煽りすぎない
- 「〜がヤバい」「衝撃の展開」「絶対見るべき」のような誇張表現は使わない
- 良い例:「藤井風の新情報、ライブ前に確認しておきたいポイント」「群馬で週末行けそうな新イベントが公開」
- 元記事にない事実を付け加えない

## ai_summaryの方針
- 2〜3行程度で、元記事の内容を簡潔に要約する
- ユーザーの登録トピックとどう関係するかが分かるようにする
- 元記事にない情報を足さない（推測や創作をしない）
- 長すぎず、スマホでも読みやすい長さにする

必ずJSONのみを返してください。日本語で生成してください。`;

export async function generateFeedItemOptimization(
  input: FeedItemOptimizationInput,
): Promise<GeneratedFeedItemOptimization> {
  const classificationText = input.classification
    ? `\nトピックの分類: 大カテゴリ=${input.classification.parentCategory} / 中カテゴリ=${input.classification.subCategory}`
    : "";

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `登録トピック: ${input.topicName}${classificationText}

元記事タイトル: ${input.originalTitle}
元記事の概要: ${input.originalSummary || "(概要なし)"}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            aiTitle: { type: "string" },
            aiSummary: { type: "string" },
          },
          required: ["aiTitle", "aiSummary"],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new AiRefusalError("AIが記事の最適化を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  return JSON.parse(textBlock.text) as GeneratedFeedItemOptimization;
}
