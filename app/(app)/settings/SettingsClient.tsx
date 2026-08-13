"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { optimizeFeedItemsWithAiAction, updatePreferredLanguage } from "./actions";
import type { PreferredLanguage } from "@/lib/language/detectLanguage";

interface SettingsClientProps {
  preferredLanguage: PreferredLanguage;
}

const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  ja: "日本語",
  en: "英語",
};

export function SettingsClient({
  preferredLanguage: initialPreferredLanguage,
}: SettingsClientProps) {
  const [preferredLanguage, setPreferredLanguage] = useState(
    initialPreferredLanguage,
  );
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResultMessage, setOptimizeResultMessage] = useState<
    string | null
  >(null);

  async function handleLanguageChange(language: PreferredLanguage) {
    if (language === preferredLanguage) return;
    setError(null);
    setIsChangingLanguage(true);
    try {
      await updatePreferredLanguage(language);
      setPreferredLanguage(language);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "言語設定の更新に失敗しました",
      );
    } finally {
      setIsChangingLanguage(false);
    }
  }

  async function handleOptimizeFeedItems() {
    setError(null);
    setOptimizeResultMessage(null);
    setIsOptimizing(true);
    try {
      const result = await optimizeFeedItemsWithAiAction();
      setOptimizeResultMessage(
        `対象${result.targetCount}件中、成功${result.succeededCount}件・スキップ${result.skippedCount}件・失敗${result.failedCount}件`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI最適化処理に失敗しました");
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold text-slate-900">設定</h1>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            記事の取得言語
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            マイページ・保存記事に表示する記事の言語を選択します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LANGUAGE_LABELS) as PreferredLanguage[]).map(
            (lang) => (
              <Button
                key={lang}
                size="sm"
                variant={preferredLanguage === lang ? "primary" : "secondary"}
                disabled={isChangingLanguage}
                onClick={() => handleLanguageChange(lang)}
              >
                {LANGUAGE_LABELS[lang]}
              </Button>
            ),
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 border-dashed border-amber-300 bg-amber-50">
        <div>
          <h2 className="text-sm font-semibold text-amber-800">
            開発用：記事のAI最適化
          </h2>
          <p className="mt-0.5 text-xs text-amber-700">
            未処理の記事（最新10件まで）にAIタイトル・AI要約・画像を生成します。AI APIの利用は課金に関わるため、手動実行のみで自動実行はしていません。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={isOptimizing}
            onClick={handleOptimizeFeedItems}
          >
            {isOptimizing ? "処理中..." : "記事タイトル・要約をAIで最適化"}
          </Button>
          {optimizeResultMessage && (
            <span className="text-xs text-slate-600">
              {optimizeResultMessage}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
