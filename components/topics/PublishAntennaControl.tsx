"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { publishTopic, unpublishTopic } from "@/app/(app)/topics/actions";
import type { Topic } from "@/types/domain";

interface PublishAntennaControlProps {
  topic: Topic;
  onChange: (topic: Topic) => void;
}

// トピック（アンテナ）の公開/非公開を切り替えるコントロール。
// 公開中は/a/[slug]のURLとフォロワー数の確認導線を表示する。
export function PublishAntennaControl({ topic, onChange }: PublishAntennaControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [publicTitle, setPublicTitle] = useState(topic.public_title ?? topic.name);
  const [publicDescription, setPublicDescription] = useState(
    topic.public_description ?? topic.description,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const publicUrl =
    topic.slug && typeof window !== "undefined"
      ? `${window.location.origin}/a/${topic.slug}`
      : null;

  async function handlePublish() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const updated = await publishTopic(topic.id, {
        publicTitle,
        publicDescription,
      });
      onChange(updated);
      setIsEditing(false);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "公開に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUnpublish() {
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const updated = await unpublishTopic(topic.id);
      onChange(updated);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "非公開化に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyUrl() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopyMessage("URLをコピーしました");
      setTimeout(() => setCopyMessage(null), 2000);
    } catch {
      // クリップボードが使えない環境では何もしない
    }
  }

  return (
    <Card className="flex flex-col gap-2 border-dashed">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">公開設定</span>
        {topic.is_public ? (
          <Badge tone="success">公開中</Badge>
        ) : (
          <Badge tone="neutral">非公開</Badge>
        )}
      </div>

      {topic.is_public && publicUrl && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-slate-600 underline underline-offset-2 hover:text-slate-900"
          >
            {publicUrl}
          </a>
          <Button size="xs" variant="ghost" onClick={handleCopyUrl}>
            コピー
          </Button>
          {copyMessage && <span className="text-emerald-600">{copyMessage}</span>}
        </div>
      )}

      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{errorMessage}</p>
      )}

      {isEditing ? (
        <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">公開タイトル</label>
            <input
              type="text"
              value={publicTitle}
              onChange={(e) => setPublicTitle(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">公開説明</label>
            <textarea
              value={publicDescription}
              onChange={(e) => setPublicDescription(e.target.value)}
              rows={2}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>
              キャンセル
            </Button>
            <Button size="sm" variant="primary" onClick={handlePublish} disabled={isSaving}>
              {isSaving ? "公開中..." : "この内容で公開する"}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {topic.is_public ? (
            <Button size="sm" variant="secondary" onClick={handleUnpublish} disabled={isSaving}>
              {isSaving ? "処理中..." : "非公開にする"}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>
              公開する
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
