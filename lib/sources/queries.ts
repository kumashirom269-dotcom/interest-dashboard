import { createClient } from "@/lib/supabase/server";
import type { Source, SourceStatus } from "@/types/domain";

export interface SourceWithTopic extends Source {
  topicName: string | null;
}

export interface SourceRow {
  id: string;
  user_id: string;
  topic_id: string;
  name: string;
  url: string;
  rss_url: string | null;
  source_type: Source["source_type"];
  status: SourceStatus;
  reason: string | null;
  priority: number;
  source_score: number;
  created_by_ai: boolean;
  last_checked_at: string | null;
  fetch_method: Source["fetch_method"] | null;
  fetch_status: Source["fetch_status"] | null;
  last_fetch_error_type: string | null;
  last_fetch_error_message: string | null;
  last_fetch_attempt_at: string | null;
  last_successful_fetch_at: string | null;
  consecutive_fetch_failure_count: number | null;
  is_official: boolean | null;
  is_specific_source: boolean | null;
  is_search_seed: boolean | null;
  source_reliability_score: number | null;
  topic_relevance_score: number | null;
  needs_review: boolean | null;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
  topics: { name: string } | null;
}

export function mapSourceRow(row: SourceRow): SourceWithTopic {
  return {
    id: row.id,
    user_id: row.user_id,
    topic_id: row.topic_id,
    name: row.name,
    url: row.url,
    rss_url: row.rss_url,
    source_type: row.source_type,
    status: row.status,
    reason: row.reason ?? "",
    priority: row.priority,
    source_score: row.source_score,
    created_by_ai: row.created_by_ai,
    last_checked_at: row.last_checked_at,
    fetch_method: row.fetch_method ?? "rss",
    fetch_status: row.fetch_status ?? "unverified",
    last_fetch_error_type: row.last_fetch_error_type,
    last_fetch_error_message: row.last_fetch_error_message,
    last_fetch_attempt_at: row.last_fetch_attempt_at,
    last_successful_fetch_at: row.last_successful_fetch_at,
    consecutive_fetch_failure_count: row.consecutive_fetch_failure_count ?? 0,
    is_official: row.is_official ?? false,
    is_specific_source: row.is_specific_source ?? true,
    is_search_seed: row.is_search_seed ?? false,
    source_reliability_score: row.source_reliability_score,
    topic_relevance_score: row.topic_relevance_score,
    needs_review: row.needs_review ?? false,
    review_reason: row.review_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    topicName: row.topics?.name ?? null,
  };
}

export async function getSourcesForUser(): Promise<SourceWithTopic[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await supabase
    .from("sources")
    .select("*, topics(name)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => mapSourceRow(row as unknown as SourceRow));
}
