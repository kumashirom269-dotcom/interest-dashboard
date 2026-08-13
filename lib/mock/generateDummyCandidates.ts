import type { Source, Topic } from "@/types/domain";

// Step1用のダミー候補生成。Step6でAI呼び出しに差し替える想定。
export function generateDummyCandidates(topic: Topic): Source[] {
  const now = new Date().toISOString();
  const baseId = `${topic.id}-cand-${Date.now()}`;

  return [
    {
      id: `${baseId}-1`,
      user_id: topic.user_id,
      topic_id: topic.id,
      name: `${topic.name}関連 公式情報サイト（ダミー）`,
      url: "https://example.com/official",
      rss_url: "https://example.com/official/rss.xml",
      source_type: "official_blog",
      status: "candidate",
      reason: `トピック「${topic.name}」に関連する公式情報が多いと推定されたため（ダミー生成）。`,
      priority: 4,
      source_score: 0,
      created_by_ai: true,
      last_checked_at: null,
      created_at: now,
      updated_at: now,
    },
    {
      id: `${baseId}-2`,
      user_id: topic.user_id,
      topic_id: topic.id,
      name: `${topic.name}まとめブログ（ダミー）`,
      url: "https://example.com/blog",
      rss_url: null,
      source_type: "tech_blog",
      status: "candidate",
      reason: `トピック「${topic.name}」の関連キーワードを多く扱っていると推定されたため（ダミー生成）。`,
      priority: 3,
      source_score: 0,
      created_by_ai: true,
      last_checked_at: null,
      created_at: now,
      updated_at: now,
    },
  ];
}
