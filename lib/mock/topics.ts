import type { Topic } from "@/types/domain";

const MOCK_USER_ID = "user-mock-001";

export const mockTopics: Topic[] = [
  {
    id: "topic-ai",
    user_id: MOCK_USER_ID,
    name: "AI",
    description:
      "生成AI、AIツール、AIを使った開発、AIニュースに興味があります。",
    keywords: ["生成AI", "AIツール", "OpenAI", "Claude", "AI開発"],
    last_collected_at: null,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-01T09:00:00Z",
  },
  {
    id: "topic-programming",
    user_id: MOCK_USER_ID,
    name: "プログラミング",
    description:
      "Web開発、フロントエンド、TypeScript、実務で使える技術記事に興味があります。",
    keywords: ["TypeScript", "Next.js", "フロントエンド", "設計"],
    last_collected_at: null,
    created_at: "2026-06-02T09:00:00Z",
    updated_at: "2026-06-02T09:00:00Z",
  },
  {
    id: "topic-brass-band",
    user_id: MOCK_USER_ID,
    name: "吹奏楽",
    description:
      "吹奏楽コンクール情報、楽譜、団体の演奏会情報を集めたいです。",
    keywords: ["吹奏楽コンクール", "楽譜", "演奏会"],
    last_collected_at: null,
    created_at: "2026-06-03T09:00:00Z",
    updated_at: "2026-06-03T09:00:00Z",
  },
  {
    id: "topic-gunma-event",
    user_id: MOCK_USER_ID,
    name: "群馬イベント",
    description: "群馬県内の地域イベント、お祭り、催し物情報を知りたいです。",
    keywords: ["群馬県", "地域イベント", "お祭り"],
    last_collected_at: null,
    created_at: "2026-06-04T09:00:00Z",
    updated_at: "2026-06-04T09:00:00Z",
  },
  {
    id: "topic-youtube-production",
    user_id: MOCK_USER_ID,
    name: "YouTube制作",
    description:
      "YouTube動画の企画・編集・機材・チャンネル運営のノウハウに興味があります。",
    keywords: ["動画編集", "YouTube運営", "機材レビュー"],
    last_collected_at: null,
    created_at: "2026-06-05T09:00:00Z",
    updated_at: "2026-06-05T09:00:00Z",
  },
];

export const MOCK_USER_ID_EXPORT = MOCK_USER_ID;
