"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SourceStatusBadge } from "./SourceStatusBadge";
import { isWebDiscoveryEligible } from "@/lib/web-discovery/eligibility";
import type { WebDiscoveryResult } from "@/lib/web-discovery/discoverLinks";
import {
  SOURCE_TYPE_LABELS,
  type FetchMethod,
  type FetchStatus,
  type Source,
  type SourceStatus,
  type SourceType,
} from "@/types/domain";

const STATUS_OPTIONS: SourceStatus[] = [
  "candidate",
  "active",
  "paused",
  "rejected",
];

const SOURCE_TYPE_OPTIONS: SourceType[] = [
  "official_blog",
  "news_site",
  "rss",
  "tech_blog",
  "local_event_site",
  "youtube_channel",
  "research_site",
  "other",
  "official_site",
  "official_news",
  "fanclub",
  "sns",
  "youtube_search",
  "magazine",
  "blog",
  "search_query",
];

const FETCH_METHOD_OPTIONS: FetchMethod[] = [
  "rss",
  "youtube_rss",
  "web_page",
  "search_query",
  "sns_reference",
  "api_required",
  "manual",
  "unsupported",
];

const FETCH_METHOD_LABELS: Record<FetchMethod, string> = {
  rss: "RSS",
  youtube_rss: "YouTube RSS",
  web_page: "Webページ探索",
  search_query: "検索クエリ",
  sns_reference: "SNS（参考情報）",
  api_required: "要API連携",
  manual: "手動確認",
  unsupported: "未対応",
};

const FETCH_STATUS_LABELS: Record<FetchStatus, string> = {
  unverified: "未検証",
  verified: "検証済み",
  broken: "取得失敗",
};

const FETCH_STATUS_TONE: Record<FetchStatus, "neutral" | "success" | "danger"> = {
  unverified: "neutral",
  verified: "success",
  broken: "danger",
};

export interface SourceSettingsInput {
  rssUrl: string;
  fetchMethod: FetchMethod;
  sourceType: SourceType;
  isOfficial: boolean;
  isSpecificSource: boolean;
  isSearchSeed: boolean;
  needsReview: boolean;
  reviewReason: string;
  sourceReliabilityScore: number | null;
  topicRelevanceScore: number | null;
}

interface SourceCardProps {
  source: Source;
  topicName?: string;
  onStatusChange?: (sourceId: string, newStatus: SourceStatus) => void;
  onUpdateSourceSettings?: (
    sourceId: string,
    input: SourceSettingsInput,
  ) => Promise<void> | void;
  onDiscoverLinks?: (sourceId: string) => Promise<void> | void;
  discoveryResult?: WebDiscoveryResult;
  isDiscovering?: boolean;
  onSaveDiscoveredLinks?: (sourceId: string) => Promise<void> | void;
  isSavingDiscoveredLinks?: boolean;
  discoveredLinksSaved?: boolean;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "未取得";
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScore(score: number | null | undefined): string {
  return score === null || score === undefined ? "" : String(score);
}

function buildSettingsInput(source: Source): SourceSettingsInput {
  return {
    rssUrl: source.rss_url ?? "",
    fetchMethod: source.fetch_method ?? "rss",
    sourceType: source.source_type,
    isOfficial: source.is_official ?? false,
    isSpecificSource: source.is_specific_source ?? true,
    isSearchSeed: source.is_search_seed ?? false,
    needsReview: source.needs_review ?? false,
    reviewReason: source.review_reason ?? "",
    sourceReliabilityScore: source.source_reliability_score ?? null,
    topicRelevanceScore: source.topic_relevance_score ?? null,
  };
}

export function SourceCard({
  source,
  topicName,
  onStatusChange,
  onUpdateSourceSettings,
  onDiscoverLinks,
  discoveryResult,
  isDiscovering,
  onSaveDiscoveredLinks,
  isSavingDiscoveredLinks,
  discoveredLinksSaved,
}: SourceCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<SourceSettingsInput>(() =>
    buildSettingsInput(source),
  );
  const [isSaving, setIsSaving] = useState(false);

  function openEditForm() {
    setForm(buildSettingsInput(source));
    setIsEditing(true);
  }

  async function handleSave() {
    if (!onUpdateSourceSettings) return;
    setIsSaving(true);
    try {
      await onUpdateSourceSettings(source.id, form);
      setIsEditing(false);
    } catch {
      // エラーメッセージは呼び出し元（SourcesPageClient）が表示するため、
      // ここではフォームを開いたままにして再試行できるようにする
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            {source.name}
          </h3>
          {topicName && (
            <p className="text-xs text-slate-500">トピック: {topicName}</p>
          )}
        </div>
        <SourceStatusBadge status={source.status} />
      </div>

      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge tone="neutral">{SOURCE_TYPE_LABELS[source.source_type]}</Badge>
        <Badge tone="info">スコア {source.source_score}</Badge>
        <Badge tone="neutral">優先度 {source.priority}</Badge>
        {source.created_by_ai && <Badge tone="neutral">AI提案</Badge>}
        <Badge tone="neutral">
          {FETCH_METHOD_LABELS[source.fetch_method ?? "rss"]}
        </Badge>
        <Badge tone={FETCH_STATUS_TONE[source.fetch_status ?? "unverified"]}>
          {FETCH_STATUS_LABELS[source.fetch_status ?? "unverified"]}
        </Badge>
        {source.is_official && <Badge tone="info">公式</Badge>}
        {source.is_specific_source === false && (
          <Badge tone="warning">具体性なし</Badge>
        )}
        {source.is_search_seed && <Badge tone="neutral">検索候補</Badge>}
        {source.needs_review && <Badge tone="warning">要確認</Badge>}
        {!source.url && <Badge tone="danger">URL未設定</Badge>}
      </div>

      {source.fetch_status === "broken" && source.last_fetch_error_message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <span className="font-medium">取得エラー：</span>
          {source.last_fetch_error_message}
        </p>
      )}

      {source.needs_review && source.review_reason && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <span className="font-medium">要確認の理由：</span>
          {source.review_reason}
        </p>
      )}

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
        <div className="truncate">
          <dt className="inline font-medium text-slate-500">URL: </dt>
          <dd className="inline">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-slate-900"
              >
                {source.url}
              </a>
            ) : (
              "未設定"
            )}
          </dd>
        </div>
        <div className="truncate">
          <dt className="inline font-medium text-slate-500">RSS: </dt>
          <dd className="inline">{source.rss_url ?? "なし"}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-500">最終取得: </dt>
          <dd className="inline">{formatDateTime(source.last_checked_at)}</dd>
        </div>
        <div>
          <dt className="inline font-medium text-slate-500">信頼度/関連度: </dt>
          <dd className="inline">
            {formatScore(source.source_reliability_score) || "未設定"} /{" "}
            {formatScore(source.topic_relevance_score) || "未設定"}
          </dd>
        </div>
      </dl>

      {onUpdateSourceSettings && !isEditing && (
        <div>
          <Button size="sm" variant="secondary" onClick={openEditForm}>
            取得設定を編集
          </Button>
        </div>
      )}

      {onUpdateSourceSettings && isEditing && (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-medium text-slate-600"
              htmlFor={`rss-url-${source.id}`}
            >
              RSS URL
            </label>
            <input
              id={`rss-url-${source.id}`}
              type="text"
              value={form.rssUrl}
              onChange={(e) => setForm((f) => ({ ...f, rssUrl: e.target.value }))}
              placeholder="https://example.com/rss"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium text-slate-600"
                htmlFor={`fetch-method-${source.id}`}
              >
                取得方法（RSS URLを入力した場合は自動的にrssになります）
              </label>
              <select
                id={`fetch-method-${source.id}`}
                value={form.fetchMethod}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    fetchMethod: e.target.value as FetchMethod,
                  }))
                }
                disabled={form.rssUrl.trim().length > 0}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
              >
                {FETCH_METHOD_OPTIONS.map((method) => (
                  <option key={method} value={method}>
                    {FETCH_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium text-slate-600"
                htmlFor={`source-type-${source.id}`}
              >
                情報源の種類
              </label>
              <select
                id={`source-type-${source.id}`}
                value={form.sourceType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sourceType: e.target.value as SourceType,
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
              >
                {SOURCE_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {SOURCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isOfficial}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isOfficial: e.target.checked }))
                }
              />
              公式
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isSpecificSource}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isSpecificSource: e.target.checked }))
                }
              />
              具体的な収集元である
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.isSearchSeed}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isSearchSeed: e.target.checked }))
                }
              />
              検索候補として扱う
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={form.needsReview}
                onChange={(e) =>
                  setForm((f) => ({ ...f, needsReview: e.target.checked }))
                }
              />
              要確認
            </label>
          </div>

          {form.needsReview && (
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium text-slate-600"
                htmlFor={`review-reason-${source.id}`}
              >
                要確認の理由
              </label>
              <input
                id={`review-reason-${source.id}`}
                type="text"
                value={form.reviewReason}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reviewReason: e.target.value }))
                }
                placeholder="例：トピックとの関連性が低い可能性がある"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium text-slate-600"
                htmlFor={`reliability-${source.id}`}
              >
                情報源の信頼度（0〜100、任意）
              </label>
              <input
                id={`reliability-${source.id}`}
                type="number"
                min={0}
                max={100}
                value={formatScore(form.sourceReliabilityScore)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sourceReliabilityScore:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-medium text-slate-600"
                htmlFor={`relevance-${source.id}`}
              >
                トピックとの関連度（0〜100、任意）
              </label>
              <input
                id={`relevance-${source.id}`}
                type="number"
                min={0}
                max={100}
                value={formatScore(form.topicRelevanceScore)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    topicRelevanceScore:
                      e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(false)}
              disabled={isSaving}
            >
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "保存中..." : "保存する"}
            </Button>
          </div>
        </div>
      )}

      {onDiscoverLinks && isWebDiscoveryEligible(source) && (
        <div className="flex flex-col gap-2">
          <div>
            <Button
              size="sm"
              variant="secondary"
              disabled={isDiscovering}
              onClick={() => onDiscoverLinks(source.id)}
            >
              {isDiscovering ? "探索中..." : "Web探索（新着ページ候補を探す）"}
            </Button>
          </div>

          {discoveryResult && discoveryResult.status === "success" && (
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <span className="font-medium text-emerald-600">探索成功</span>
              {discoveryResult.discoveredLinks.length === 0 ? (
                <p>候補リンクなし（HTML取得は成功したが、該当キーワードのリンクが見つかりませんでした）</p>
              ) : (
                <>
                  <ul className="flex flex-col gap-1">
                    {discoveryResult.discoveredLinks.map((link) => (
                      <li key={link.url} className="truncate">
                        <span className="font-medium text-slate-700">
                          [{link.matchedKeyword}] (score {link.score})
                        </span>{" "}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-slate-900"
                        >
                          {link.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                  {onSaveDiscoveredLinks && (
                    <div>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSavingDiscoveredLinks || discoveredLinksSaved}
                        onClick={() => onSaveDiscoveredLinks(source.id)}
                      >
                        {discoveredLinksSaved
                          ? "候補として保存済み"
                          : isSavingDiscoveredLinks
                            ? "保存中..."
                            : "すべて候補として保存"}
                      </Button>
                      <p className="mt-1 text-[11px] text-slate-400">
                        候補(candidate)状態で保存されます。activeへの切り替えは保存後に手動で行ってください。
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {discoveryResult && discoveryResult.status !== "success" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              <span className="font-medium">探索失敗：</span>
              {discoveryResult.errorMessage ?? "不明なエラー"}
            </p>
          )}
        </div>
      )}

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <span className="font-medium text-slate-700">AIが選んだ理由：</span>
        {source.reason}
      </p>

      {onStatusChange && (
        <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
          <label className="text-xs font-medium text-slate-600" htmlFor={`status-${source.id}`}>
            status変更:
          </label>
          <select
            id={`status-${source.id}`}
            value={source.status}
            onChange={(e) =>
              onStatusChange(source.id, e.target.value as SourceStatus)
            }
            className="rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      )}
    </Card>
  );
}
