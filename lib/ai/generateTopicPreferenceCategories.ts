import Anthropic from "@anthropic-ai/sdk";
import {
  PREFERENCE_CATEGORY_TYPES,
  PREFERENCE_CATEGORY_TYPE_LABELS,
  type GeneratedPreferenceCategory,
  type PreferenceCategoryType,
} from "@/lib/topic-preferences/types";
import type { TopicClassification } from "@/lib/topic-classification/types";

const client = new Anthropic();

const MIN_CATEGORIES = 8;
const MAX_CATEGORIES = 10;
const MIN_SELECTED = 5;
const MAX_SELECTED = 7;

interface TopicInput {
  name: string;
  description: string;
  keywords: string[];
  classification?: TopicClassification;
}

const SYSTEM_PROMPT = `あなたは、ユーザーが登録した関心トピックについて、「集めたい情報カテゴリ」の選択肢を提案するアシスタントです。

カテゴリは固定リストから選ぶのではなく、トピックの内容に合わせて毎回自然な日本語で生成してください
（例:「THE ALFEE」なら「コンサートツアー情報」「メンバーのメディア出演」、「群馬の新しい飲食店」なら「新規オープン情報」「グルメメディアの特集」など、
トピックの実態に即した具体的な名前にする）。

必ず以下を守ってください。
- カテゴリは${MIN_CATEGORIES}〜${MAX_CATEGORIES}個生成する
- labelは短く自然な日本語（例:「コンサートツアー情報」）
- descriptionは、そのカテゴリにどんな情報が含まれるかの一行説明
- categoryTypeは、指定された内部分類の候補から最も近いものを1つ選ぶ（迷う場合はother）
- preferenceKeyは、英小文字とアンダースコアのみのsnake_case識別子にする（例: concert_tour_info）。他のカテゴリと重複しないユニークな値にする
- defaultSelectedは、ユーザーにとって重要そうなカテゴリを${MIN_SELECTED}〜${MAX_SELECTED}個程度trueにし、残りをfalseにする
- priorityは0〜100の整数で、重要度の目安を表す
- 必ずJSONのみを返す（説明文やコードブロックの記法は不要）
- 日本語で生成する（categoryTypeの値自体は指定の英語識別子を使う）

categoryTypeの候補: ${PREFERENCE_CATEGORY_TYPES.join(", ")}
（参考: ${PREFERENCE_CATEGORY_TYPES.map((t) => `${t}=${PREFERENCE_CATEGORY_TYPE_LABELS[t]}`).join(", ")}）`;

function buildClassificationSection(classification?: TopicClassification): string {
  if (!classification) return "";

  return `

AIによる分類結果（参考情報）:
- entityType: ${classification.entityType}
- 大カテゴリ: ${classification.parentCategory}
- 中カテゴリ: ${classification.subCategory}
- 詳細カテゴリ: ${classification.detailCategory}
- 概要: ${classification.summary}
- 追跡したい情報: ${classification.intentTags.join(", ")}`;
}

interface RawCategory {
  label: string;
  description: string;
  categoryType: string;
  preferenceKey: string;
  defaultSelected: boolean;
  priority: number;
}

function normalizeCategoryType(value: string): PreferenceCategoryType {
  return (PREFERENCE_CATEGORY_TYPES as string[]).includes(value)
    ? (value as PreferenceCategoryType)
    : "other";
}

// AIが生成したpreferenceKeyを、snake_case・重複なしの安全な識別子に正規化する
// （unique(topic_id, preference_key)制約を満たすため）。
function normalizePreferenceKey(rawKey: string, index: number, seen: Set<string>): string {
  const base =
    rawKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `category_${index + 1}`;

  let candidate = base;
  let suffix = 2;
  while (seen.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  seen.add(candidate);
  return candidate;
}

// AIの選択数がユーザー指定の範囲（5〜7個程度）から外れた場合に、
// priorityの高い/低い順で機械的に調整する安全弁。
function normalizeSelection(
  categories: GeneratedPreferenceCategory[],
): GeneratedPreferenceCategory[] {
  const selectedCount = categories.filter((c) => c.isSelected).length;

  if (selectedCount > MAX_SELECTED) {
    const sorted = [...categories].sort((a, b) => b.priority - a.priority);
    const keepKeys = new Set(
      sorted.filter((c) => c.isSelected).slice(0, MAX_SELECTED).map((c) => c.preferenceKey),
    );
    return categories.map((c) => ({
      ...c,
      isSelected: c.isSelected && keepKeys.has(c.preferenceKey),
    }));
  }

  if (selectedCount < MIN_SELECTED) {
    const sorted = [...categories].sort((a, b) => b.priority - a.priority);
    const addKeys = new Set(
      sorted.filter((c) => !c.isSelected).slice(0, MIN_SELECTED - selectedCount).map((c) => c.preferenceKey),
    );
    return categories.map((c) => ({
      ...c,
      isSelected: c.isSelected || addKeys.has(c.preferenceKey),
    }));
  }

  return categories;
}

export async function generateTopicPreferenceCategories(
  topic: TopicInput,
): Promise<GeneratedPreferenceCategory[]> {
  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `トピック名: ${topic.name}
説明: ${topic.description || "(説明なし)"}
キーワード: ${topic.keywords.length > 0 ? topic.keywords.join(", ") : "(なし)"}${buildClassificationSection(
          topic.classification,
        )}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            categories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  label: { type: "string" },
                  description: { type: "string" },
                  categoryType: { type: "string", enum: PREFERENCE_CATEGORY_TYPES },
                  preferenceKey: { type: "string" },
                  defaultSelected: { type: "boolean" },
                  priority: { type: "integer" },
                },
                required: [
                  "label",
                  "description",
                  "categoryType",
                  "preferenceKey",
                  "defaultSelected",
                  "priority",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["categories"],
          additionalProperties: false,
        },
      },
    },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AIがカテゴリ提案の生成を拒否しました。");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("AIの応答からテキストを取得できませんでした。");
  }

  const parsed = JSON.parse(textBlock.text) as { categories: RawCategory[] };

  const seenKeys = new Set<string>();
  const categories = parsed.categories
    .slice(0, MAX_CATEGORIES)
    .map((c, index) => ({
      label: c.label,
      description: c.description,
      categoryType: normalizeCategoryType(c.categoryType),
      preferenceKey: normalizePreferenceKey(c.preferenceKey, index, seenKeys),
      isSelected: c.defaultSelected,
      priority: Math.min(100, Math.max(0, Math.round(c.priority))),
    }));

  return normalizeSelection(categories);
}
