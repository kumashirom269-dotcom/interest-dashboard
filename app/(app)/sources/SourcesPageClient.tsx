"use client";

import { useState, useTransition } from "react";
import { SourceCard, type SourceSettingsInput } from "@/components/sources/SourceCard";
import { Button } from "@/components/ui/Button";
import {
  createSampleSource,
  discoverSourceLinks,
  fetchActiveSourcesRss,
  saveDiscoveredLinksAsSources,
  updateSourceSettings,
  updateSourceStatus,
  type FetchRssResult,
} from "./actions";
import type { SourceWithTopic } from "@/lib/sources/queries";
import type { WebDiscoveryResult } from "@/lib/web-discovery/discoverLinks";
import type { SourceStatus } from "@/types/domain";
import { DEV_TOOLS_ENABLED } from "@/lib/config/devTools";

interface TopicOption {
  id: string;
  name: string;
}

interface SourcesPageClientProps {
  initialSources: SourceWithTopic[];
  topics: TopicOption[];
}

export function SourcesPageClient({
  initialSources,
  topics,
}: SourcesPageClientProps) {
  const [sources, setSources] = useState<SourceWithTopic[]>(initialSources);
  const [selectedTopicId, setSelectedTopicId] = useState(topics[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isFetchingRss, setIsFetchingRss] = useState(false);
  const [rssResult, setRssResult] = useState<FetchRssResult | null>(null);
  const [discoveryResults, setDiscoveryResults] = useState<
    Record<string, WebDiscoveryResult>
  >({});
  const [discoveringSourceIds, setDiscoveringSourceIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingDiscoveredLinksIds, setSavingDiscoveredLinksIds] = useState<
    Set<string>
  >(new Set());
  const [savedDiscoveredLinksIds, setSavedDiscoveredLinksIds] = useState<
    Set<string>
  >(new Set());

  async function handleStatusChange(sourceId: string, status: SourceStatus) {
    setError(null);
    const previous = sources;
    setSources((cur) =>
      cur.map((s) => (s.id === sourceId ? { ...s, status } : s)),
    );
    try {
      await updateSourceStatus(sourceId, status);
    } catch (e) {
      setSources(previous);
      setError(e instanceof Error ? e.message : "statusの更新に失敗しました");
    }
  }

  async function handleUpdateSourceSettings(
    sourceId: string,
    input: SourceSettingsInput,
  ) {
    setError(null);
    try {
      const updated = await updateSourceSettings(sourceId, input);
      setSources((cur) => cur.map((s) => (s.id === sourceId ? updated : s)));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "取得設定の更新に失敗しました",
      );
      throw e;
    }
  }

  async function handleDiscoverLinks(sourceId: string) {
    setError(null);
    setDiscoveringSourceIds((cur) => new Set(cur).add(sourceId));
    try {
      const result = await discoverSourceLinks(sourceId);
      setDiscoveryResults((cur) => ({ ...cur, [sourceId]: result }));
      setSavedDiscoveredLinksIds((cur) => {
        const next = new Set(cur);
        next.delete(sourceId);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Web探索に失敗しました");
    } finally {
      setDiscoveringSourceIds((cur) => {
        const next = new Set(cur);
        next.delete(sourceId);
        return next;
      });
    }
  }

  async function handleSaveDiscoveredLinks(sourceId: string) {
    const result = discoveryResults[sourceId];
    if (!result || result.discoveredLinks.length === 0) return;

    setError(null);
    setSavingDiscoveredLinksIds((cur) => new Set(cur).add(sourceId));
    try {
      const saved = await saveDiscoveredLinksAsSources(
        sourceId,
        result.discoveredLinks,
      );
      setSources((cur) => [...cur, ...saved.savedSources]);
      setSavedDiscoveredLinksIds((cur) => new Set(cur).add(sourceId));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "候補の保存に失敗しました",
      );
    } finally {
      setSavingDiscoveredLinksIds((cur) => {
        const next = new Set(cur);
        next.delete(sourceId);
        return next;
      });
    }
  }

  function handleCreateSample() {
    if (!selectedTopicId) return;
    setError(null);
    startTransition(async () => {
      try {
        const source = await createSampleSource(selectedTopicId);
        setSources((prev) => [...prev, source]);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "サンプル収集元の追加に失敗しました",
        );
      }
    });
  }

  async function handleFetchRss() {
    setError(null);
    setRssResult(null);
    setIsFetchingRss(true);
    try {
      const result = await fetchActiveSourcesRss();
      setRssResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "RSSの取得に失敗しました");
    } finally {
      setIsFetchingRss(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold text-slate-900">収集元管理</h1>
      <p className="text-sm text-slate-500">
        登録済みの収集元一覧です。statusを変更するとSupabaseに保存されます。
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {DEV_TOOLS_ENABLED && (
        <>
          {topics.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
              <span className="text-xs font-semibold text-amber-700">
                開発用：
              </span>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending}
                onClick={handleCreateSample}
              >
                {isPending
                  ? "追加中..."
                  : "開発用：現在のトピックにサンプル収集元を追加"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3">
            <span className="text-xs font-semibold text-amber-700">開発用：</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={isFetchingRss}
              onClick={handleFetchRss}
            >
              {isFetchingRss ? "取得中..." : "activeな収集元からRSSを取得"}
            </Button>
            {rssResult && (
              <span className="text-xs text-slate-600">
                {rssResult.sourcesChecked}件の収集元を確認し、
                {rssResult.itemsFetched}件の新規記事を保存しました。
                {rssResult.itemsSkippedByLanguage > 0 &&
                  `（言語設定により${rssResult.itemsSkippedByLanguage}件スキップ）`}
              </span>
            )}
          </div>

          {rssResult && (
            <div className="flex flex-col gap-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
              <span className="text-xs font-semibold text-slate-600">
                開発用：RSS取得結果の詳細
              </span>
              <ul className="flex flex-col gap-1">
                {rssResult.results.map((r) => (
                  <li key={r.sourceId} className="text-xs text-slate-600">
                    <span
                      className={
                        r.status === "failed"
                          ? "font-medium text-red-600"
                          : r.status === "skipped"
                            ? "font-medium text-slate-400"
                            : "font-medium text-emerald-600"
                      }
                    >
                      [{r.status === "success" ? "成功" : r.status === "failed" ? "失敗" : "スキップ"}]
                    </span>{" "}
                    {r.sourceName}
                    {r.rssUrl && (
                      <span className="text-slate-400"> ({r.rssUrl})</span>
                    )}
                    {" — "}
                    取得{r.fetchedItemCount}件 / 保存{r.savedItemCount}件
                    {r.skippedByLanguageCount > 0 &&
                      ` / 言語スキップ${r.skippedByLanguageCount}件`}
                    {r.skippedAsDuplicateCount > 0 &&
                      ` / 重複スキップ${r.skippedAsDuplicateCount}件`}
                    {r.errorMessage && (
                      <span className="text-slate-500">
                        {" "}
                        — {r.errorMessage}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {sources.length === 0 ? (
        <p className="text-sm text-slate-500">
          まだ収集元がありません。Step6でAIがトピックから収集元候補を生成します。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              topicName={source.topicName ?? undefined}
              onStatusChange={handleStatusChange}
              onUpdateSourceSettings={handleUpdateSourceSettings}
              onDiscoverLinks={handleDiscoverLinks}
              discoveryResult={discoveryResults[source.id]}
              isDiscovering={discoveringSourceIds.has(source.id)}
              onSaveDiscoveredLinks={handleSaveDiscoveredLinks}
              isSavingDiscoveredLinks={savingDiscoveredLinksIds.has(source.id)}
              discoveredLinksSaved={savedDiscoveredLinksIds.has(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
