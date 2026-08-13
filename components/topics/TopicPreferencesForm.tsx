"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DESIRED_CONTENT_TYPES,
  DESIRED_CONTENT_TYPE_LABELS,
  DISPLAY_TONES,
  DISPLAY_TONE_LABELS,
  DEFAULT_TOPIC_PREFERENCE_SETTINGS,
  EXCLUDED_TENDENCIES,
  EXCLUDED_TENDENCY_LABELS,
  TARGET_LEVELS,
  TARGET_LEVEL_LABELS,
  type DesiredContentType,
  type DisplayTone,
  type ExcludedTendency,
  type TargetLevel,
  type TopicPreferenceSettings,
} from "@/lib/topic-preference-settings/types";
import type { TopicPreferenceSettingsInput } from "@/lib/topic-preference-settings/queries";

interface TopicPreferencesFormProps {
  initialPreferences?: TopicPreferenceSettings;
  submitting?: boolean;
  onSubmit: (input: TopicPreferenceSettingsInput) => void;
  onCancel: () => void;
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function TopicPreferencesForm({
  initialPreferences,
  submitting,
  onSubmit,
  onCancel,
}: TopicPreferencesFormProps) {
  const base = initialPreferences ?? DEFAULT_TOPIC_PREFERENCE_SETTINGS;
  const [targetLevel, setTargetLevel] = useState<TargetLevel>(base.targetLevel);
  const [desiredContentTypes, setDesiredContentTypes] = useState<
    DesiredContentType[]
  >(base.desiredContentTypes);
  const [displayTone, setDisplayTone] = useState<DisplayTone>(base.displayTone);
  const [excludedTendencies, setExcludedTendencies] = useState<
    ExcludedTendency[]
  >(base.excludedTendencies);
  const [supplementaryNotes, setSupplementaryNotes] = useState(
    base.supplementaryNotes,
  );
  const [userFocus, setUserFocus] = useState(base.userFocus);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      targetLevel,
      desiredContentTypes,
      displayTone,
      excludedTendencies,
      supplementaryNotes: supplementaryNotes.trim(),
      userFocus: userFocus.trim(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
    >
      <div>
        <p className="text-xs font-medium text-slate-600">対象レベル</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {TARGET_LEVELS.map((level) => (
            <Button
              key={level}
              type="button"
              size="sm"
              variant={targetLevel === level ? "primary" : "secondary"}
              onClick={() => setTargetLevel(level)}
            >
              {TARGET_LEVEL_LABELS[level]}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">欲しい情報の種類</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DESIRED_CONTENT_TYPES.map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant={
                desiredContentTypes.includes(type) ? "primary" : "secondary"
              }
              onClick={() =>
                setDesiredContentTypes((prev) => toggleInArray(prev, type))
              }
            >
              {DESIRED_CONTENT_TYPE_LABELS[type]}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">表示トーン</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DISPLAY_TONES.map((tone) => (
            <Button
              key={tone}
              type="button"
              size="sm"
              variant={displayTone === tone ? "primary" : "secondary"}
              onClick={() => setDisplayTone(tone)}
            >
              {DISPLAY_TONE_LABELS[tone]}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-600">除外したい傾向</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {EXCLUDED_TENDENCIES.map((tendency) => (
            <Button
              key={tendency}
              type="button"
              size="sm"
              variant={
                excludedTendencies.includes(tendency) ? "primary" : "secondary"
              }
              onClick={() =>
                setExcludedTendencies((prev) => toggleInArray(prev, tendency))
              }
            >
              {EXCLUDED_TENDENCY_LABELS[tendency]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor="topic-preferences-user-focus"
        >
          特に知りたいこと
        </label>
        <input
          id="topic-preferences-user-focus"
          value={userFocus}
          onChange={(e) => setUserFocus(e.target.value)}
          placeholder="例：個人開発の事例を優先してほしい"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium text-slate-600"
          htmlFor="topic-preferences-notes"
        >
          補足説明
        </label>
        <textarea
          id="topic-preferences-notes"
          value={supplementaryNotes}
          onChange={(e) => setSupplementaryNotes(e.target.value)}
          placeholder="例：ライブラリ更新だけの記事は避けてほしい"
          rows={2}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting ? "保存中..." : "保存する"}
        </Button>
      </div>
    </form>
  );
}
