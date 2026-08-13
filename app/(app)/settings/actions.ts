"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updatePreferredFeedLanguageForUser } from "@/lib/profiles/queries";
import { getTopicClassificationsForUser } from "@/lib/topic-classification/queries";
import {
  AiRefusalError,
  generateFeedItemOptimization,
} from "@/lib/ai/generateFeedItemOptimization";
import { resolveImageForFeedItem } from "@/lib/images/resolveArticleImage";
import type { PreferredLanguage } from "@/lib/language/detectLanguage";

export async function updatePreferredLanguage(
  language: PreferredLanguage,
): Promise<PreferredLanguage> {
  const result = await updatePreferredFeedLanguageForUser(language);
  revalidatePath("/mypage");
  revalidatePath("/saved");
  revalidatePath("/settings");
  return result;
}

const OPTIMIZE_BATCH_SIZE = 10;

export interface OptimizeFeedItemsResult {
  targetCount: number;
  succeededCount: number;
  skippedCount: number;
  failedCount: number;
}

// ai_title/ai_summaryが未生成のfeed_itemsを、最新順に最大10件AIで最適化する（開発用・手動実行）。
// 併せて画像（RSS由来 → OGP → カテゴリ別デフォルト）も解決してimage_urlに保存する。
// 一度処理した記事はai_processed_atが入るため、何度実行しても同じ記事を処理し直さない。
// AI APIの利用は課金に関わるため、自動実行はせず、この開発用画面からの手動実行のみにしている。
export async function optimizeFeedItemsWithAiAction(): Promise<OptimizeFeedItemsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: targets, error } = await supabase
    .from("feed_items")
    .select("id, topic_id, title, summary, raw_excerpt, url, image_url, topics(name)")
    .eq("user_id", user.id)
    .is("ai_processed_at", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(OPTIMIZE_BATCH_SIZE);

  if (error) throw error;

  const classifications = await getTopicClassificationsForUser();

  const result: OptimizeFeedItemsResult = {
    targetCount: targets?.length ?? 0,
    succeededCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const item of targets ?? []) {
    try {
      const topicsField = item.topics as
        | { name: string }[]
        | { name: string }
        | null;
      const topicName =
        (Array.isArray(topicsField) ? topicsField[0]?.name : topicsField?.name) ??
        "登録トピック";
      const classification = classifications[item.topic_id];

      const generated = await generateFeedItemOptimization({
        topicName,
        classification,
        originalTitle: item.title,
        originalSummary: item.summary || item.raw_excerpt || "",
      });

      const imageUrl = await resolveImageForFeedItem(
        item.image_url,
        item.url,
        classification?.entityType,
      );

      const { error: updateError } = await supabase
        .from("feed_items")
        .update({
          ai_title: generated.aiTitle,
          ai_summary: generated.aiSummary,
          image_url: imageUrl,
          ai_processed_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;
      result.succeededCount += 1;
    } catch (e) {
      if (e instanceof AiRefusalError) {
        result.skippedCount += 1;
      } else {
        result.failedCount += 1;
      }
    }
  }

  revalidatePath("/mypage");
  revalidatePath("/saved");
  return result;
}
