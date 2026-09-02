"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SourceCard } from "@/components/sources/SourceCard";
import { TOPIC_ENTITY_TYPE_LABELS } from "@/lib/topic-classification/types";
import type { TopicClassification } from "@/lib/topic-classification/types";
import { TopicPreferencesForm } from "./TopicPreferencesForm";
import { DEV_TOOLS_ENABLED } from "@/lib/config/devTools";
import {
  DESIRED_CONTENT_TYPE_LABELS,
  DISPLAY_TONE_LABELS,
  EXCLUDED_TENDENCY_LABELS,
  TARGET_LEVEL_LABELS,
  type TopicPreferenceSettings,
} from "@/lib/topic-preference-settings/types";
import type { TopicPreferenceSettingsInput } from "@/lib/topic-preference-settings/queries";
import {
  PREFERENCE_CATEGORY_TYPE_LABELS,
  type TopicPreferenceCategory,
} from "@/lib/topic-preferences/types";
import { SOURCE_TYPE_LABELS } from "@/types/domain";
import type { Source, SourceStatus, Topic } from "@/types/domain";

interface TopicListProps {
  topics: Topic[];
  sources: Source[];
  generatingTopicId: string | null;
  generatedTopicId: string | null;
  classifyingTopicId: string | null;
  classifications: Record<string, TopicClassification>;
  preferences: Record<string, TopicPreferenceSettings>;
  categories: Record<string, TopicPreferenceCategory[]>;
  editingPreferencesTopicId: string | null;
  savingPreferencesTopicId: string | null;
  onEdit: (topic: Topic) => void;
  onDelete: (topicId: string) => void;
  onGenerateSources: (topicId: string) => void;
  onClassifyTopic: (topicId: string) => void;
  onTogglePreferencesForm: (topicId: string | null) => void;
  onSavePreferences: (topicId: string, input: TopicPreferenceSettingsInput) => void;
  onSourceStatusChange: (sourceId: string, status: SourceStatus) => void;
}

function ClassificationResult({
  classification,
}: {
  classification: TopicClassification;
}) {
  const confidencePercent = Math.round(classification.confidence * 100);

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          {TOPIC_ENTITY_TYPE_LABELS[classification.entityType]}
        </Badge>
        {classification.needsUserConfirmation && (
          <Badge tone="warning">確認が必要</Badge>
        )}
        <span className="text-xs text-slate-500">
          AIの信頼度：{confidencePercent}%
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-slate-500">大カテゴリ</dt>
          <dd className="text-slate-800">{classification.parentCategory}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">中カテゴリ</dt>
          <dd className="text-slate-800">{classification.subCategory}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">詳細カテゴリ</dt>
          <dd className="text-slate-800">{classification.detailCategory}</dd>
        </div>
      </dl>

      {classification.summary && (
        <p className="text-xs text-slate-600">{classification.summary}</p>
      )}

      <div>
        <p className="text-xs font-medium text-slate-500">
          このトピックで追跡できる情報
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {classification.intentTags.map((tag) => (
            <Badge key={tag} tone="info">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500">
          おすすめの情報源タイプ
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {classification.recommendedSourceTypes.map((type) => (
            <Badge key={type} tone="neutral">
              {SOURCE_TYPE_LABELS[type]}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500">検索キーワード</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {classification.searchKeywords.map((keyword) => (
            <Badge key={keyword} tone="neutral">
              {keyword}
            </Badge>
          ))}
        </div>
      </div>

      {classification.needsUserConfirmation && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-medium text-amber-800">
            AIの分類に自信がありません。次の候補のどれに近いですか？
          </p>
          {classification.ambiguityReason && (
            <p className="mt-1 text-xs text-amber-700">
              理由：{classification.ambiguityReason}
            </p>
          )}
          {classification.candidateEntities.length > 0 && (
            <ol className="mt-2 flex flex-col gap-1.5">
              {classification.candidateEntities.map((candidate, index) => (
                <li
                  key={`${candidate.label}-${index}`}
                  className="rounded bg-white p-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-slate-800">
                      {index + 1}. {candidate.label}
                    </span>
                    <Badge tone="neutral">
                      {TOPIC_ENTITY_TYPE_LABELS[candidate.entityType]}
                    </Badge>
                    <span className="text-[11px] text-slate-500">
                      信頼度：{Math.round(candidate.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-slate-600">
                    {candidate.parentCategory} / {candidate.subCategory}
                  </p>
                  <p className="mt-0.5 text-slate-600">{candidate.description}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {classification.researchHints.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">
            今後の調査観点（将来のWeb調査用）
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {classification.researchHints.map((hint) => (
              <Badge key={hint} tone="neutral">
                {hint}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {classification.notes && (
        <p className="text-xs text-amber-700">備考：{classification.notes}</p>
      )}
    </div>
  );
}

function TopicPreferenceCategoriesSummary({
  categories,
}: {
  categories: TopicPreferenceCategory[];
}) {
  if (categories.length === 0) return null;

  const sorted = [...categories].sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-3 text-sm">
      <p className="text-xs font-medium text-slate-500">
        集めたい情報カテゴリ（登録時にAIが提案・選択したもの）
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sorted.map((category) => (
          <Badge
            key={category.id}
            tone={category.isSelected ? "info" : "neutral"}
            className={category.isSelected ? "" : "opacity-60"}
          >
            {category.label}（{PREFERENCE_CATEGORY_TYPE_LABELS[category.categoryType]}）
          </Badge>
        ))}
      </div>
    </div>
  );
}

function TopicPreferencesSummary({
  preferences,
}: {
  preferences: TopicPreferenceSettings;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral">{TARGET_LEVEL_LABELS[preferences.targetLevel]}</Badge>
        <Badge tone="neutral">{DISPLAY_TONE_LABELS[preferences.displayTone]}</Badge>
      </div>
      {preferences.desiredContentTypes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">欲しい情報の種類</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {preferences.desiredContentTypes.map((type) => (
              <Badge key={type} tone="info">
                {DESIRED_CONTENT_TYPE_LABELS[type]}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {preferences.excludedTendencies.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500">除外したい傾向</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {preferences.excludedTendencies.map((tendency) => (
              <Badge key={tendency} tone="danger">
                {EXCLUDED_TENDENCY_LABELS[tendency]}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {preferences.userFocus && (
        <p className="text-xs text-slate-600">
          特に知りたいこと：{preferences.userFocus}
        </p>
      )}
      {preferences.supplementaryNotes && (
        <p className="text-xs text-slate-600">
          補足：{preferences.supplementaryNotes}
        </p>
      )}
    </div>
  );
}

export function TopicList({
  topics,
  sources,
  generatingTopicId,
  generatedTopicId,
  classifyingTopicId,
  classifications,
  preferences,
  categories,
  editingPreferencesTopicId,
  savingPreferencesTopicId,
  onEdit,
  onDelete,
  onGenerateSources,
  onClassifyTopic,
  onTogglePreferencesForm,
  onSavePreferences,
  onSourceStatusChange,
}: TopicListProps) {
  if (topics.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        トピックがまだ登録されていません。上のフォームから追加してください。
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {topics.map((topic) => {
        const topicSources = sources.filter((s) => s.topic_id === topic.id);
        const isGenerating = generatingTopicId === topic.id;
        const justGenerated = generatedTopicId === topic.id;
        const isClassifying = classifyingTopicId === topic.id;
        const classification = classifications[topic.id];
        const topicPreferences = preferences[topic.id];
        const topicCategories = categories[topic.id] ?? [];
        const isEditingPreferences = editingPreferencesTopicId === topic.id;
        const isSavingPreferences = savingPreferencesTopicId === topic.id;

        return (
          <Card key={topic.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {topic.name}
                </h3>
                <p className="mt-0.5 text-sm text-slate-600">
                  {topic.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topic.keywords.map((keyword) => (
                    <Badge key={keyword} tone="neutral">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => onEdit(topic)}>
                  編集
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onDelete(topic.id)}
                >
                  削除
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  onTogglePreferencesForm(isEditingPreferences ? null : topic.id)
                }
              >
                {isEditingPreferences ? "好み設定を閉じる" : "AIの好み設定"}
              </Button>
            </div>

            {classification && (
              <ClassificationResult classification={classification} />
            )}

            <TopicPreferenceCategoriesSummary categories={topicCategories} />

            {DEV_TOOLS_ENABLED && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-2.5">
                <span className="text-xs font-semibold text-amber-700">
                  開発用：
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isClassifying}
                  onClick={() => onClassifyTopic(topic.id)}
                >
                  {isClassifying ? "分類中..." : "AIで再分類する"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isGenerating}
                  onClick={() => onGenerateSources(topic.id)}
                >
                  {isGenerating ? "生成中..." : "収集元候補を再生成する"}
                </Button>
                <span className="text-[11px] text-amber-700">
                  （登録時に自動実行済み。品質確認・再実行用）
                </span>
                {justGenerated && (
                  <span className="text-xs font-medium text-emerald-600">
                    候補を生成しました
                  </span>
                )}
              </div>
            )}

            {isEditingPreferences ? (
              <TopicPreferencesForm
                initialPreferences={topicPreferences}
                submitting={isSavingPreferences}
                onSubmit={(input) => onSavePreferences(topic.id, input)}
                onCancel={() => onTogglePreferencesForm(null)}
              />
            ) : (
              topicPreferences && (
                <TopicPreferencesSummary preferences={topicPreferences} />
              )
            )}

            {topicSources.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-slate-500">
                  紐づく収集元（{topicSources.length}件）
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {topicSources.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onStatusChange={onSourceStatusChange}
                    />
                  ))}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
