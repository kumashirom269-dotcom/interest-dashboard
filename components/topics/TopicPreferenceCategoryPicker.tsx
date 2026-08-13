"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  PREFERENCE_CATEGORY_TYPE_LABELS,
  TOPIC_PREFERENCE_INTRO_TEXT,
  type GeneratedPreferenceCategory,
} from "@/lib/topic-preferences/types";

interface TopicPreferenceCategoryPickerProps {
  topicName: string;
  categories: GeneratedPreferenceCategory[];
  submitting?: boolean;
  onToggle: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TopicPreferenceCategoryPicker({
  topicName,
  categories,
  submitting,
  onToggle,
  onConfirm,
  onCancel,
}: TopicPreferenceCategoryPickerProps) {
  const selectedCount = categories.filter((c) => c.isSelected).length;

  // 登録フローの摩擦を減らすため（実データ検証で「一般消費者が最初のトピック登録を
  // 完了するまでの手数」が離脱要因になり得ると判明）、カテゴリのチェックリストは
  // 既定で折りたたみ、AIが自動選択した内容のままワンクリックで登録できる導線を
  // 最上部に置く。選ばなかったカテゴリも収集対象から完全には外れないため
  // （下記の注記の通り）、チェックリストを毎回精読しなくても支障が出にくい設計になっている。
  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          「{topicName}」の登録内容を確認
        </h3>
        <p className="mt-1 text-xs text-slate-600">
          AIが「{topicName}」で集めたい情報カテゴリを{selectedCount}件自動で選びました。このまま登録できます。
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          キャンセル
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onConfirm}
          disabled={submitting}
        >
          {submitting ? "登録して情報を収集しています..." : "この内容で登録する"}
        </Button>
      </div>

      <details className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer select-none text-xs font-medium text-slate-600">
          集めたい情報カテゴリを確認・調整する（任意）
        </summary>
        <p className="mt-2 text-xs text-slate-600">{TOPIC_PREFERENCE_INTRO_TEXT}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {categories.map((category, index) => (
            <li
              key={category.preferenceKey}
              className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={category.isSelected}
                onChange={() => onToggle(index)}
              />
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-800">
                    {category.label}
                  </span>
                  <Badge tone="neutral">
                    {PREFERENCE_CATEGORY_TYPE_LABELS[category.categoryType]}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600">{category.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          {selectedCount}件選択中。選ばなかったカテゴリも、話題性や公式性が高い情報は引き続き収集・表示の対象になります。
        </p>
      </details>
    </Card>
  );
}
