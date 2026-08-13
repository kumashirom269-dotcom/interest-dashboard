import {
  INFORMATION_TYPES,
  INFORMATION_TYPE_LABELS,
  type InformationType,
} from "@/lib/recommendation-cards/types";

// トピック登録時にAIが提案する「集めたい情報カテゴリ」の内部分類。
// recommendation_cards.information_typeと同じ語彙を再利用する（どちらも
// 「情報の種類」という同じ概念を表すため。将来、選択カテゴリの優先度で
// おすすめカードを重みづけする際に、変換テーブルなしで直接突き合わせられる）。
export type PreferenceCategoryType = InformationType;
export const PREFERENCE_CATEGORY_TYPES: PreferenceCategoryType[] = INFORMATION_TYPES;
export const PREFERENCE_CATEGORY_TYPE_LABELS: Record<PreferenceCategoryType, string> =
  INFORMATION_TYPE_LABELS;

export type PreferenceSource = "ai" | "user" | "system";

// 確認画面に表示する「あなたが特に見たい情報を選んでください」の説明文。
export const TOPIC_PREFERENCE_INTRO_TEXT =
  "あなたが特に見たい情報を選んでください。ここで選んだ内容を中心に、話題性の高い情報もあわせて集めます。";

// トピック登録確認画面でユーザーに提示する、1トピック分のAI生成カテゴリ候補。
// まだDBに保存されていない状態（プレビュー）を表す。
export interface GeneratedPreferenceCategory {
  label: string;
  description: string;
  categoryType: PreferenceCategoryType;
  preferenceKey: string;
  isSelected: boolean;
  priority: number;
}

// DBに保存された後の1カテゴリ。
export interface TopicPreferenceCategory extends GeneratedPreferenceCategory {
  id: string;
  topicId: string;
  aiGenerated: boolean;
  source: PreferenceSource;
  visibleToUser: boolean;
  weight: number | null;
  negativeWeight: number | null;
  displayOrder: number | null;
  createdAt: string;
  updatedAt: string;
}
