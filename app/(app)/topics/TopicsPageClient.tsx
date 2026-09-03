"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopicForm, type TopicFormValues } from "@/components/topics/TopicForm";
import { TopicIdentificationPanel } from "@/components/topics/TopicIdentificationPanel";
import { TopicList } from "@/components/topics/TopicList";
import { TopicPreferenceCategoryPicker } from "@/components/topics/TopicPreferenceCategoryPicker";
import { Button } from "@/components/ui/Button";
import { updateSourceStatus } from "@/app/(app)/sources/actions";
import type { SourceWithTopic } from "@/lib/sources/queries";
import type { TopicClassification } from "@/lib/topic-classification/types";
import type { TopicPreferenceSettingsInput } from "@/lib/topic-preference-settings/queries";
import type { TopicPreferenceSettings } from "@/lib/topic-preference-settings/types";
import type {
  GeneratedPreferenceCategory,
  TopicPreferenceCategory,
} from "@/lib/topic-preferences/types";
import {
  MAX_CLARIFICATION_ROUNDS,
  type CandidateEntity,
  type IdentifiedEntity,
  type TopicIdentificationResult,
} from "@/lib/topic-identification/types";
import {
  classifyTopicAction,
  confirmTopicRegistration,
  deleteTopic,
  generateSourceCandidates,
  getTopicCollectionStatus,
  identifyTopicAction,
  previewTopicRegistration,
  updateTopic,
  updateTopicPreferencesAction,
  type TopicCollectionStatus,
} from "./actions";
import type { SourceStatus, Topic } from "@/types/domain";

function toKeywordArray(keywordsText: string): string[] {
  return keywordsText
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

interface TopicInputValues {
  name: string;
  description: string;
  keywords: string[];
}

interface IdentificationFlowState {
  input: TopicInputValues;
  additionalInfoHistory: string[];
  result: TopicIdentificationResult;
}

interface RegistrationPreview {
  input: TopicInputValues;
  classification: TopicClassification;
  categories: GeneratedPreferenceCategory[];
}

interface TopicsPageClientProps {
  initialTopics: Topic[];
  initialSources: SourceWithTopic[];
  initialClassifications: Record<string, TopicClassification>;
  initialPreferenceSettings: Record<string, TopicPreferenceSettings>;
  initialPreferenceCategories: Record<string, TopicPreferenceCategory[]>;
}

export function TopicsPageClient({
  initialTopics,
  initialSources,
  initialClassifications,
  initialPreferenceSettings,
  initialPreferenceCategories,
}: TopicsPageClientProps) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [sources, setSources] = useState<SourceWithTopic[]>(initialSources);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormInitialValues, setAddFormInitialValues] =
    useState<TopicFormValues | undefined>(undefined);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identificationFlow, setIdentificationFlow] =
    useState<IdentificationFlowState | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [registrationPreview, setRegistrationPreview] =
    useState<RegistrationPreview | null>(null);
  const [isConfirmingRegistration, setIsConfirmingRegistration] = useState(false);
  // 自動収集パイプラインはバックグラウンド実行（after()）に変更したため、登録直後は
  // トピック名・IDだけを保持し、進捗はgetTopicCollectionStatusのポーリングで確認する。
  const [justRegistered, setJustRegistered] = useState<{
    topicId: string;
    topicName: string;
  } | null>(null);
  const [collectionStatus, setCollectionStatus] = useState<TopicCollectionStatus | null>(null);
  const [collectionPollTimedOut, setCollectionPollTimedOut] = useState(false);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingTopicId, setGeneratingTopicId] = useState<string | null>(
    null,
  );
  const [generatedTopicId, setGeneratedTopicId] = useState<string | null>(
    null,
  );
  const [classifyingTopicId, setClassifyingTopicId] = useState<string | null>(
    null,
  );
  const [classifications, setClassifications] = useState<
    Record<string, TopicClassification>
  >(initialClassifications);
  const [preferenceSettings, setPreferenceSettings] = useState<
    Record<string, TopicPreferenceSettings>
  >(initialPreferenceSettings);
  const [preferenceCategories, setPreferenceCategories] = useState<
    Record<string, TopicPreferenceCategory[]>
  >(initialPreferenceCategories);
  const [editingPreferencesTopicId, setEditingPreferencesTopicId] = useState<
    string | null
  >(null);
  const [savingPreferencesTopicId, setSavingPreferencesTopicId] = useState<
    string | null
  >(null);

  // 登録直後、バックグラウンドで実行中の自動収集パイプラインの完了を
  // 3秒間隔でポーリングして確認する（最大約2分）。完了したらrouter.refresh()で
  // トピック一覧・マイページのサーバーデータを最新化する。
  useEffect(() => {
    if (!justRegistered || collectionStatus?.done) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      attempts += 1;
      try {
        const status = await getTopicCollectionStatus(justRegistered!.topicId);
        if (cancelled) return;
        setCollectionStatus(status);
        if (status.done) {
          router.refresh();
          return;
        }
      } catch {
        // ポーリング自体の失敗はユーザーへ表示するほどではないため、次回に任せる。
      }
      if (attempts >= maxAttempts) {
        setCollectionPollTimedOut(true);
        return;
      }
      timeoutId = setTimeout(poll, 3000);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justRegistered?.topicId]);

  // トピック名の入力を受けたら、まず対象特定ゲート（identifyTopicAction）を呼ぶ。
  // topics/topic_classifications/topic_preferencesへの書き込みはこの時点では一切発生しない。
  async function handleCreate(values: TopicFormValues) {
    setError(null);
    setIsIdentifying(true);
    try {
      const input: TopicInputValues = {
        name: values.name.trim(),
        description: values.description.trim(),
        keywords: toKeywordArray(values.keywords),
      };
      const result = await identifyTopicAction(input, []);
      setIdentificationFlow({ input, additionalInfoHistory: [], result });
      setShowAddForm(false);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "対象特定の解析に失敗しました",
      );
    } finally {
      setIsIdentifying(false);
    }
  }

  // needs_selectionの候補をユーザーが選んだ場合は、追加のAI呼び出しをせず
  // その場でidentifiedEntityとして確定する（候補データ自体はAIがすでに生成済みのため）。
  // ただし、候補自体がneedsMoreInfo（例:「好きな芸能人のテレビ出演」を選んだが対象名が
  // 分からない）の場合は、まだ確定させずneeds_more_infoへ遷移し、
  // suggestedQuestionをそのままclarificationQuestionとして表示する。
  function handleSelectCandidate(candidate: CandidateEntity) {
    setIdentificationFlow((prev) => {
      if (!prev) return prev;

      if (candidate.needsMoreInfo) {
        return {
          ...prev,
          result: {
            ...prev.result,
            identificationStatus: "needs_more_info",
            identifiedEntity: null,
            candidateEntities: [],
            clarificationQuestion:
              candidate.suggestedQuestion ?? `${candidate.name}について、対象を具体的に教えてください。`,
            requestedAdditionalInfo: ["description"],
            canProceedToPreferenceSelection: false,
          },
        };
      }

      const identifiedEntity: IdentifiedEntity = {
        name: candidate.suggestedTopicName || candidate.name,
        entityType: candidate.entityType,
        description: candidate.description,
        canonicalUrl: null,
        officialUrl: candidate.officialUrl ?? null,
        youtubeChannelUrl: candidate.youtubeChannelUrl ?? null,
        confidence: candidate.confidence,
        topicKind: candidate.topicKind,
      };
      return {
        ...prev,
        result: {
          ...prev.result,
          identificationStatus: "identified",
          identifiedEntity,
          candidateEntities: [],
          clarificationQuestion: null,
          canProceedToPreferenceSelection: true,
        },
      };
    });
  }

  // 追加情報を受けて対象特定を再実行する。ラウンド数の上限（MAX_CLARIFICATION_ROUNDS）に
  // 達してもまだ特定できない場合は、AIの判定によらずnot_identifiableへ強制する
  // （無限に質問を繰り返さないため）。
  async function handleSubmitAdditionalInfo(info: string) {
    if (!identificationFlow) return;
    setError(null);
    setIsIdentifying(true);
    try {
      const newHistory = [...identificationFlow.additionalInfoHistory, info];
      let result = await identifyTopicAction(identificationFlow.input, newHistory);

      if (
        result.identificationStatus !== "identified" &&
        newHistory.length >= MAX_CLARIFICATION_ROUNDS
      ) {
        result = {
          ...result,
          identificationStatus: "not_identifiable",
          identifiedEntity: null,
          candidateEntities: [],
          canProceedToPreferenceSelection: false,
          clarificationQuestion: null,
          reason: `確認を${MAX_CLARIFICATION_ROUNDS}回行いましたが、対象を特定できませんでした。より確実なURL等を入力してください。`,
        };
      }

      setIdentificationFlow({
        input: identificationFlow.input,
        additionalInfoHistory: newHistory,
        result,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "対象特定の再解析に失敗しました",
      );
    } finally {
      setIsIdentifying(false);
    }
  }

  function handleChangeTopicName() {
    if (identificationFlow) {
      setAddFormInitialValues({
        name: identificationFlow.input.name,
        description: identificationFlow.input.description,
        keywords: identificationFlow.input.keywords.join(", "),
      });
    }
    setIdentificationFlow(null);
    setShowAddForm(true);
  }

  function handleCancelIdentification() {
    setIdentificationFlow(null);
  }

  // 対象特定ゲートを通過した場合のみ、カテゴリ提案（previewTopicRegistration）へ進む。
  async function handleProceedToCategories() {
    if (!identificationFlow) return;
    const { identifiedEntity } = identificationFlow.result;
    if (
      identificationFlow.result.identificationStatus !== "identified" ||
      !identifiedEntity
    ) {
      return;
    }

    setError(null);
    setIsGeneratingPreview(true);
    try {
      const preview = await previewTopicRegistration(
        identificationFlow.input,
        identifiedEntity,
        identificationFlow.additionalInfoHistory,
      );
      setRegistrationPreview({
        input: identificationFlow.input,
        classification: preview.classification,
        categories: preview.categories,
      });
      setIdentificationFlow(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "カテゴリ提案の生成に失敗しました",
      );
    } finally {
      setIsGeneratingPreview(false);
    }
  }

  function handleToggleCategory(index: number) {
    setRegistrationPreview((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((c, i) =>
          i === index ? { ...c, isSelected: !c.isSelected } : c,
        ),
      };
    });
  }

  async function handleConfirmRegistration() {
    if (!registrationPreview) return;
    setError(null);
    setIsConfirmingRegistration(true);
    try {
      const result = await confirmTopicRegistration(
        registrationPreview.input,
        registrationPreview.classification,
        registrationPreview.categories,
      );
      setTopics((prev) => [...prev, result.topic]);
      setClassifications((prev) => ({
        ...prev,
        [result.topic.id]: result.classification,
      }));
      setPreferenceCategories((prev) => ({
        ...prev,
        [result.topic.id]: result.categories,
      }));
      setRegistrationPreview(null);
      setAddFormInitialValues(undefined);
      setCollectionStatus(null);
      setCollectionPollTimedOut(false);
      setJustRegistered({
        topicId: result.topic.id,
        topicName: result.topic.name,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "トピックの登録に失敗しました");
    } finally {
      setIsConfirmingRegistration(false);
    }
  }

  function handleCancelRegistration() {
    setRegistrationPreview(null);
  }

  async function handleUpdate(values: TopicFormValues) {
    if (!editingTopic) return;
    setError(null);
    setSubmitting(true);
    try {
      const topic = await updateTopic(editingTopic.id, {
        name: values.name.trim(),
        description: values.description.trim(),
        keywords: toKeywordArray(values.keywords),
      });
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? topic : t)));
      setEditingTopic(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "トピックの更新に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(topicId: string) {
    setError(null);
    try {
      await deleteTopic(topicId);
      setTopics((prev) => prev.filter((t) => t.id !== topicId));
      setSources((prev) => prev.filter((s) => s.topic_id !== topicId));
      setClassifications((prev) => {
        const next = { ...prev };
        delete next[topicId];
        return next;
      });
      setPreferenceCategories((prev) => {
        const next = { ...prev };
        delete next[topicId];
        return next;
      });
      if (editingTopic?.id === topicId) setEditingTopic(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "トピックの削除に失敗しました");
    }
  }

  async function handleGenerateSources(topicId: string) {
    setError(null);
    setGeneratingTopicId(topicId);
    setGeneratedTopicId(null);
    try {
      const candidates = await generateSourceCandidates(topicId);
      setSources((prev) => [...prev, ...candidates]);
      setGeneratedTopicId(topicId);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "収集元候補の生成に失敗しました",
      );
    } finally {
      setGeneratingTopicId(null);
    }
  }

  async function handleSourceStatusChange(
    sourceId: string,
    status: SourceStatus,
  ) {
    setError(null);
    const previous = sources;
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, status } : s)),
    );
    try {
      await updateSourceStatus(sourceId, status);
    } catch (e) {
      setSources(previous);
      setError(e instanceof Error ? e.message : "statusの更新に失敗しました");
    }
  }

  async function handleClassifyTopic(topicId: string) {
    setError(null);
    setClassifyingTopicId(topicId);
    try {
      const classification = await classifyTopicAction(topicId);
      setClassifications((prev) => ({ ...prev, [topicId]: classification }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "トピックの分類に失敗しました");
    } finally {
      setClassifyingTopicId(null);
    }
  }

  async function handleSavePreferences(
    topicId: string,
    input: TopicPreferenceSettingsInput,
  ) {
    setError(null);
    setSavingPreferencesTopicId(topicId);
    try {
      const saved = await updateTopicPreferencesAction(topicId, input);
      setPreferenceSettings((prev) => ({ ...prev, [topicId]: saved }));
      setEditingPreferencesTopicId(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "好み設定の保存に失敗しました",
      );
    } finally {
      setSavingPreferencesTopicId(null);
    }
  }

  const isBusyWithRegistration =
    showAddForm || !!identificationFlow || !!registrationPreview;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">
          トピック管理
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          気になるテーマを登録するほど、AIがあなた専用の情報源に育てていきます。
        </p>
      </div>

      {/* 主要導線として視認性を上げる（レビュー指摘: 以前は右上の小さいボタンで目立たなかった）。
          単語登録だけでも動く（AIが推測する）ことをボタン直下で明示し、心理的なハードルを下げる。 */}
      {!isBusyWithRegistration && !editingTopic && (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
          <Button
            size="lg"
            variant="primary"
            onClick={() => {
              setAddFormInitialValues(undefined);
              setShowAddForm(true);
            }}
          >
            ＋ 新しいトピックを追加
          </Button>
          <p className="text-xs text-slate-500">
            トピック名を入れるだけでOK。詳しい説明が無くてもAIが内容を推測します。
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {justRegistered && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          <div className="flex flex-1 items-start gap-3">
            {!collectionStatus?.done && !collectionPollTimedOut && (
              <span
                className="mt-0.5 h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600"
                aria-hidden
              />
            )}
            <div className="flex flex-col gap-1">
              {collectionStatus?.done ? (
                <>
                  <p className="font-medium">
                    「{justRegistered.topicName}」の情報収集が完了しました。
                  </p>
                  <p className="text-xs text-emerald-700">
                    {collectionStatus.cardsCount > 0
                      ? `おすすめカードを${collectionStatus.cardsCount}件準備しました。マイページで確認できます。`
                      : "今回はまだ十分な情報が見つかりませんでした。時間を置いて自動で再収集されるまでお待ちいただくか、収集元（sources）を確認してみてください。"}
                  </p>
                </>
              ) : collectionPollTimedOut ? (
                <>
                  <p className="font-medium">
                    「{justRegistered.topicName}」を登録しました。
                  </p>
                  <p className="text-xs text-emerald-700">
                    情報収集に少し時間がかかっています。準備ができ次第マイページに表示されるので、しばらくしてからご確認ください。
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    「{justRegistered.topicName}」を登録しました。
                  </p>
                  <p className="text-xs text-emerald-700">
                    AIが情報を集めています…（通常30秒〜1分程度です。このままページを離れても収集は続きます）
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {collectionStatus?.done && collectionStatus.cardsCount > 0 && (
              <Button size="sm" variant="primary" onClick={() => router.push("/mypage")}>
                マイページを見る
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setJustRegistered(null)}>
              閉じる
            </Button>
          </div>
        </div>
      )}

      {showAddForm && (
        <TopicForm
          initialValues={addFormInitialValues}
          submitLabel={isIdentifying ? "AIが対象を解析中..." : "次へ（AIが対象を確認します）"}
          onSubmit={handleCreate}
          onCancel={() => {
            setShowAddForm(false);
            setAddFormInitialValues(undefined);
          }}
        />
      )}

      {identificationFlow && (
        <TopicIdentificationPanel
          result={identificationFlow.result}
          remainingRounds={
            MAX_CLARIFICATION_ROUNDS - identificationFlow.additionalInfoHistory.length
          }
          isProcessing={isIdentifying}
          isProceeding={isGeneratingPreview}
          onSelectCandidate={handleSelectCandidate}
          onSubmitAdditionalInfo={handleSubmitAdditionalInfo}
          onChangeTopicName={handleChangeTopicName}
          onCancel={handleCancelIdentification}
          onProceed={handleProceedToCategories}
        />
      )}

      {registrationPreview && (
        <TopicPreferenceCategoryPicker
          topicName={registrationPreview.input.name}
          categories={registrationPreview.categories}
          submitting={isConfirmingRegistration}
          onToggle={handleToggleCategory}
          onConfirm={handleConfirmRegistration}
          onCancel={handleCancelRegistration}
        />
      )}

      {editingTopic && (
        <TopicForm
          initialValues={{
            name: editingTopic.name,
            description: editingTopic.description,
            keywords: editingTopic.keywords.join(", "),
          }}
          submitLabel={submitting ? "更新中..." : "更新する"}
          onSubmit={handleUpdate}
          onCancel={() => setEditingTopic(null)}
        />
      )}

      <TopicList
        topics={topics}
        sources={sources}
        generatingTopicId={generatingTopicId}
        generatedTopicId={generatedTopicId}
        classifyingTopicId={classifyingTopicId}
        classifications={classifications}
        preferences={preferenceSettings}
        categories={preferenceCategories}
        editingPreferencesTopicId={editingPreferencesTopicId}
        savingPreferencesTopicId={savingPreferencesTopicId}
        onEdit={(topic) => {
          setShowAddForm(false);
          setEditingTopic(topic);
        }}
        onDelete={handleDelete}
        onGenerateSources={handleGenerateSources}
        onClassifyTopic={handleClassifyTopic}
        onTogglePreferencesForm={setEditingPreferencesTopicId}
        onSavePreferences={handleSavePreferences}
        onSourceStatusChange={handleSourceStatusChange}
      />
    </div>
  );
}
