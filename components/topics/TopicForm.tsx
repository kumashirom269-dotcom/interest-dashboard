"use client";

import { useState, type SubmitEvent } from "react";
import { Button } from "@/components/ui/Button";

export interface TopicFormValues {
  name: string;
  description: string;
  keywords: string;
}

interface TopicFormProps {
  initialValues?: TopicFormValues;
  submitLabel?: string;
  onSubmit: (values: TopicFormValues) => void;
  onCancel?: () => void;
}

const EMPTY_VALUES: TopicFormValues = {
  name: "",
  description: "",
  keywords: "",
};

export function TopicForm({
  initialValues = EMPTY_VALUES,
  submitLabel = "追加する",
  onSubmit,
  onCancel,
}: TopicFormProps) {
  const [values, setValues] = useState<TopicFormValues>(initialValues);
  // 説明文・キーワードは任意項目であることを伝えるため、既に入力済みの場合（編集時等）を
  // 除いて既定では折りたたんでおく（レビュー指摘: 「単語だけでもAIが推測する」という
  // 気軽さが伝わりにくかった）。
  const [showDetails, setShowDetails] = useState(
    () => Boolean(initialValues.description || initialValues.keywords),
  );

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.name.trim()) return;
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-600" htmlFor="topic-name">
          トピック名
        </label>
        <input
          id="topic-name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="例：AI"
          autoFocus
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <p className="text-xs text-slate-500">
          単語の登録だけでもOK。AIが内容を推測して情報収集を始めます。
        </p>
      </div>

      {showDetails ? (
        <>
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium text-slate-600"
              htmlFor="topic-description"
            >
              説明文（任意）
            </label>
            <textarea
              id="topic-description"
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              placeholder="例：生成AI、AIツール、AIを使った開発に興味があります"
              rows={2}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium text-slate-600"
              htmlFor="topic-keywords"
            >
              関連キーワード（任意・カンマ区切り）
            </label>
            <input
              id="topic-keywords"
              value={values.keywords}
              onChange={(e) =>
                setValues((v) => ({ ...v, keywords: e.target.value }))
              }
              placeholder="例：生成AI, AIツール, OpenAI"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="self-start text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
        >
          対象を判断しづらそうな場合は、説明文・キーワードを詳しく入力する（任意）
        </button>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button type="submit" variant="primary" size="sm">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
