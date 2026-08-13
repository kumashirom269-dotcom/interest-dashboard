import type { Reaction } from "@/types/domain";
import { MOCK_USER_ID_EXPORT as USER_ID } from "./topics";

// Step1では「保存済み記事」画面の初期表示用に、
// あらかじめ save 済みという体のダミーリアクションだけを用意している。
export const mockReactions: Reaction[] = [
  {
    id: "reaction-1",
    user_id: USER_ID,
    feed_item_id: "feed-ai-1",
    source_id: "source-openai-blog",
    reaction_type: "save",
    created_at: "2026-07-05T11:00:00Z",
  },
  {
    id: "reaction-2",
    user_id: USER_ID,
    feed_item_id: "feed-brass-band-1",
    source_id: "source-ajba",
    reaction_type: "save",
    created_at: "2026-07-01T10:00:00Z",
  },
];
