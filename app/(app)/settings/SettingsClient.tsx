"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  deleteOwnAccountAction,
  optimizeFeedItemsWithAiAction,
  updatePreferredLanguage,
} from "./actions";
import { createClient } from "@/lib/supabase/client";
import type { PreferredLanguage } from "@/lib/language/detectLanguage";
import { DEV_TOOLS_ENABLED } from "@/lib/config/devTools";

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
  const router = useRouter();
  const [preferredLanguage, setPreferredLanguage] = useState(
    initialPreferredLanguage,
  );
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeResultMessage, setOptimizeResultMessage] = useState<
    string | null
  >(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // 取り消せない操作だが、文字入力（キーボード操作）は求めず、タップだけで完結させる
  // （レビュー指摘: 「削除」と入力させる方式は一般的でなく、退会したい人ほど負担に
  // なる）。「削除する」ボタン→警告カード内の「本当に削除する」ボタン→ネイティブの
  // confirm()ダイアログ、の2〜3タップで完了する構成にした。confirm()は最後の
  // 誤操作防止の砦として残す（タップ1回で済み、キーボードは不要）。
  async function handleDeleteAccount() {
    if (
      !window.confirm(
        "アカウントを完全に削除します。登録したトピック・収集元・保存記事・リアクション履歴を含む、すべてのデータが元に戻せなくなります。本当に削除しますか？",
      )
    ) {
      return;
    }

    setError(null);
    setIsDeleting(true);
    try {
      await deleteOwnAccountAction();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } catch (e) {
      setIsDeleting(false);
      setError(
        e instanceof Error ? e.message : "アカウントの削除に失敗しました",
      );
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

      {DEV_TOOLS_ENABLED && (
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
      )}

      <Card className="flex flex-col gap-3 border-red-200">
        <div>
          <h2 className="text-sm font-semibold text-red-700">
            アカウントを削除
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            登録したトピック・収集元・保存記事・リアクション履歴を含む、すべてのデータが完全に削除されます。この操作は取り消せません。
          </p>
        </div>

        {!showDeleteConfirm ? (
          <Button
            size="sm"
            variant="danger"
            onClick={() => setShowDeleteConfirm(true)}
            className="self-start"
          >
            アカウントを削除する
          </Button>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-800">
              一度削除すると元に戻せません。よろしいですか？
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setShowDeleteConfirm(false)}
              >
                キャンセル
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={isDeleting}
                onClick={handleDeleteAccount}
              >
                {isDeleting ? "削除中..." : "本当に削除する"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
