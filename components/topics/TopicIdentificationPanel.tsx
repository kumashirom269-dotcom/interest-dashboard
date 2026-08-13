"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  REQUESTED_ADDITIONAL_INFO_LABELS,
  TOPIC_KIND_LABELS,
  type CandidateEntity,
  type TopicIdentificationResult,
} from "@/lib/topic-identification/types";

interface TopicIdentificationPanelProps {
  result: TopicIdentificationResult;
  remainingRounds: number;
  isProcessing?: boolean;
  isProceeding?: boolean;
  onSelectCandidate: (candidate: CandidateEntity) => void;
  onSubmitAdditionalInfo: (info: string) => void;
  onChangeTopicName: () => void;
  onCancel: () => void;
  onProceed: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  return <Badge tone="info">信頼度：{Math.round(confidence * 100)}%</Badge>;
}

export function TopicIdentificationPanel({
  result,
  remainingRounds,
  isProcessing,
  isProceeding,
  onSelectCandidate,
  onSubmitAdditionalInfo,
  onChangeTopicName,
  onCancel,
  onProceed,
}: TopicIdentificationPanelProps) {
  const [additionalInfo, setAdditionalInfo] = useState("");

  function handleSubmitAdditionalInfo() {
    if (!additionalInfo.trim()) return;
    onSubmitAdditionalInfo(additionalInfo.trim());
    setAdditionalInfo("");
  }

  if (result.identificationStatus === "identified" && result.identifiedEntity) {
    const entity = result.identifiedEntity;
    return (
      <Card className="flex flex-col gap-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">
            対象を特定しました：{entity.name}（{entity.entityType}）
          </p>
          <p className="mt-1 text-xs text-emerald-700">{entity.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="success">{TOPIC_KIND_LABELS[entity.topicKind]}</Badge>
            <ConfidenceBadge confidence={entity.confidence} />
            {entity.canonicalUrl && <Badge tone="neutral">{entity.canonicalUrl}</Badge>}
            {entity.officialUrl && <Badge tone="neutral">公式: {entity.officialUrl}</Badge>}
            {entity.youtubeChannelUrl && (
              <Badge tone="neutral">YouTube: {entity.youtubeChannelUrl}</Badge>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onChangeTopicName}>
            トピック名を変更する
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onProceed}
            disabled={isProceeding}
          >
            {isProceeding ? "カテゴリを提案中..." : "この対象で確認して次へ"}
          </Button>
        </div>
      </Card>
    );
  }

  if (result.identificationStatus === "not_identifiable") {
    return (
      <Card className="flex flex-col gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-medium text-red-800">
            この情報だけでは対象を特定できなかったため、トピックとして登録できませんでした。
          </p>
          <p className="mt-1 text-xs text-red-700">
            {result.clarificationQuestion ?? result.reason}
          </p>
          <p className="mt-1 text-xs text-red-700">
            公式サイトURL、YouTubeチャンネルURL、またはより詳しい説明を入力して、もう一度お試しください。
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            キャンセル
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onChangeTopicName}>
            トピック名を変更する
          </Button>
        </div>
      </Card>
    );
  }

  // needs_selection または needs_more_info
  return (
    <Card className="flex flex-col gap-3">
      {result.identificationStatus === "needs_selection" && (
        <div>
          <p className="text-sm font-medium text-slate-800">
            複数の候補が見つかりました。どれについて情報を集めますか？
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {result.candidateEntities.map((candidate, index) => (
              <div
                key={`${candidate.name}-${index}`}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-800">
                    {candidate.suggestedTopicName || candidate.name}
                  </span>
                  <Badge tone="info">{TOPIC_KIND_LABELS[candidate.topicKind]}</Badge>
                  <Badge tone="neutral">{candidate.entityType}</Badge>
                  <ConfidenceBadge confidence={candidate.confidence} />
                </div>
                <p className="text-xs text-slate-600">{candidate.description}</p>
                {(candidate.officialUrl || candidate.youtubeChannelUrl) && (
                  <p className="text-xs text-slate-500">
                    {candidate.officialUrl}
                    {candidate.officialUrl && candidate.youtubeChannelUrl ? " / " : ""}
                    {candidate.youtubeChannelUrl}
                  </p>
                )}
                {candidate.needsMoreInfo ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-amber-700">
                      {candidate.suggestedQuestion ?? "この候補を選ぶには、対象をもう少し詳しく教えてください。"}
                    </p>
                    <div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => onSelectCandidate(candidate)}
                      >
                        この方向で詳細を入力する
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onSelectCandidate(candidate)}
                    >
                      この候補を選ぶ
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.identificationStatus === "needs_more_info" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            この名前だけでは対象を特定できませんでした。
          </p>
          {result.clarificationQuestion && (
            <p className="mt-1 text-xs text-amber-700">{result.clarificationQuestion}</p>
          )}
          {result.requestedAdditionalInfo.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.requestedAdditionalInfo.map((info) => (
                <Badge key={info} tone="warning">
                  {REQUESTED_ADDITIONAL_INFO_LABELS[info]}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor="topic-identification-additional-info"
        >
          {result.identificationStatus === "needs_selection"
            ? "どれでもない場合は、追加情報を入力してください"
            : "追加情報"}
        </label>
        <input
          id="topic-identification-additional-info"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          placeholder="例：https://www.youtube.com/@channelname／例：ゲーム実況をしている〇〇さん"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
        <p className="text-[11px] text-slate-400">
          あと{Math.max(remainingRounds, 0)}回まで確認できます。
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onChangeTopicName}>
          トピック名を変更する
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSubmitAdditionalInfo}
          disabled={isProcessing || !additionalInfo.trim()}
        >
          {isProcessing ? "再確認中..." : "再確認する"}
        </Button>
      </div>
    </Card>
  );
}
