import type { FeedItem } from "@/types/domain";
import { MOCK_USER_ID_EXPORT as USER_ID } from "./topics";

export const mockFeedItems: FeedItem[] = [
  // --- AI ---
  {
    id: "feed-ai-1",
    user_id: USER_ID,
    topic_id: "topic-ai",
    source_id: "source-openai-blog",
    title: "新しいモデルAPIのアップデートを発表",
    url: "https://openai.com/blog/example-api-update",
    source_name: "OpenAI Blog",
    published_at: "2026-07-05T10:00:00Z",
    raw_excerpt:
      "本日、新しいAPIエンドポイントとレート制限の緩和について発表しました。開発者はより低いレイテンシで...",
    summary:
      "OpenAIが新APIエンドポイントを発表。レイテンシが改善され、レート制限も緩和された。既存アプリはSDK更新のみで移行可能。",
    ai_comment:
      "登録トピック「AI」の関連キーワード『OpenAI』『AI開発』に直接合致するため、実務への影響が大きい情報です。",
    related_topics: ["AI", "生成AI", "OpenAI"],
    relevance_score: 92,
    created_at: "2026-07-05T10:30:00Z",
    updated_at: "2026-07-05T10:30:00Z",
  },
  {
    id: "feed-ai-2",
    user_id: USER_ID,
    topic_id: "topic-ai",
    source_id: "source-google-ai-blog",
    title: "マルチモーダルモデルの研究成果を公開",
    url: "https://ai.googleblog.com/example-multimodal",
    source_name: "Google AI Blog",
    published_at: "2026-07-04T08:00:00Z",
    raw_excerpt:
      "画像・音声・テキストを統合的に扱う新しい研究成果について解説します。ベンチマークでは既存手法を...",
    summary:
      "Googleが画像・音声・テキストを統合処理するマルチモーダルモデルの研究成果を公開。既存ベンチマークを上回る精度。",
    ai_comment:
      "「生成AI」「AI開発」に関連する最新研究のため、今後のツール選定の参考になります。",
    related_topics: ["AI", "生成AI"],
    relevance_score: 78,
    created_at: "2026-07-04T08:30:00Z",
    updated_at: "2026-07-04T08:30:00Z",
  },
  {
    id: "feed-ai-3",
    user_id: USER_ID,
    topic_id: "topic-ai",
    source_id: "source-huggingface-blog",
    title: "軽量オープンモデルの新バージョンをリリース",
    url: "https://huggingface.co/blog/example-lightweight-model",
    source_name: "Hugging Face Blog",
    published_at: "2026-07-02T12:00:00Z",
    raw_excerpt:
      "ローカル環境でも動作可能な軽量モデルの新バージョンをリリースしました。推論速度が前バージョン比で...",
    summary:
      "Hugging Faceが軽量なオープンモデルの新版をリリース。ローカル推論速度が前バージョンより向上。",
    ai_comment: "「AIツール」として個人開発でも試しやすい情報です。",
    related_topics: ["AI", "AIツール"],
    relevance_score: 65,
    created_at: "2026-07-02T12:30:00Z",
    updated_at: "2026-07-02T12:30:00Z",
  },

  // --- プログラミング ---
  {
    id: "feed-programming-1",
    user_id: USER_ID,
    topic_id: "topic-programming",
    source_id: "source-zenn",
    title: "Next.js 16での実践的なキャッシュ戦略まとめ",
    url: "https://zenn.dev/example/articles/nextjs-16-cache-strategy",
    source_name: "Zenn",
    published_at: "2026-07-05T07:00:00Z",
    raw_excerpt:
      "Next.js 16で変わったキャッシュAPIについて、実務でのユースケース別に整理しました...",
    summary:
      "Next.js 16の新しいキャッシュAPI（updateTag/revalidateTag等）を用途別に整理した実践記事。",
    ai_comment:
      "登録トピック「プログラミング」の関連キーワード『Next.js』に直接合致します。",
    related_topics: ["プログラミング", "Next.js", "TypeScript"],
    relevance_score: 88,
    created_at: "2026-07-05T07:30:00Z",
    updated_at: "2026-07-05T07:30:00Z",
  },
  {
    id: "feed-programming-2",
    user_id: USER_ID,
    topic_id: "topic-programming",
    source_id: "source-qiita",
    title: "TypeScriptの型パズルで学ぶ条件型入門",
    url: "https://qiita.com/example/items/type-puzzle-intro",
    source_name: "Qiita",
    published_at: "2026-07-03T09:00:00Z",
    raw_excerpt:
      "条件型・infer・マップ型を組み合わせた型パズルを題材に、実務で使える型定義力を鍛えます...",
    summary:
      "TypeScriptの条件型・infer・マップ型を型パズル形式で解説する入門記事。実務レベルの型定義に応用可能。",
    ai_comment: "「TypeScript」に直結する学習コンテンツです。",
    related_topics: ["プログラミング", "TypeScript"],
    relevance_score: 71,
    created_at: "2026-07-03T09:30:00Z",
    updated_at: "2026-07-03T09:30:00Z",
  },

  // --- 吹奏楽 ---
  {
    id: "feed-brass-band-1",
    user_id: USER_ID,
    topic_id: "topic-brass-band",
    source_id: "source-ajba",
    title: "全日本吹奏楽コンクール 全国大会の開催概要を発表",
    url: "https://ajba.or.jp/example-national-contest-2026",
    source_name: "全日本吹奏楽連盟",
    published_at: "2026-07-01T09:00:00Z",
    raw_excerpt:
      "本年度の全国大会の開催日程・会場・出場団体の選考方法について発表しました...",
    summary:
      "全日本吹奏楽連盟が全国大会の開催日程・会場・出場選考方法を発表。例年より会場が変更に。",
    ai_comment:
      "登録トピック「吹奏楽」の関連キーワード『吹奏楽コンクール』に直接合致する一次情報です。",
    related_topics: ["吹奏楽", "吹奏楽コンクール"],
    relevance_score: 95,
    created_at: "2026-07-01T09:30:00Z",
    updated_at: "2026-07-01T09:30:00Z",
  },
  {
    id: "feed-brass-band-2",
    user_id: USER_ID,
    topic_id: "topic-brass-band",
    source_id: "source-band-journal",
    title: "2026年度課題曲の解説・演奏のポイント特集",
    url: "https://band-journal.example.com/example-2026-required-pieces",
    source_name: "バンドジャーナル公式サイト",
    published_at: "2026-06-28T09:00:00Z",
    raw_excerpt:
      "今年度の課題曲について、作曲者インタビューと演奏上のポイントを特集しています...",
    summary:
      "2026年度吹奏楽コンクール課題曲の作曲者インタビューと演奏のポイントを特集した記事。",
    ai_comment: "「楽譜」「吹奏楽コンクール」双方に関連する実践的な情報です。",
    related_topics: ["吹奏楽", "楽譜"],
    relevance_score: 80,
    created_at: "2026-06-28T09:30:00Z",
    updated_at: "2026-06-28T09:30:00Z",
  },

  // --- 群馬イベント ---
  {
    id: "feed-gunma-event-1",
    user_id: USER_ID,
    topic_id: "topic-gunma-event",
    source_id: "source-gunma-pref",
    title: "夏の県内イベントカレンダーを公開",
    url: "https://pref.gunma.jp/event/example-summer-calendar",
    source_name: "群馬県公式サイト イベント情報",
    published_at: "2026-06-30T09:00:00Z",
    raw_excerpt:
      "県内各市町村で開催される夏祭り・花火大会の日程を一覧で公開しました...",
    summary:
      "群馬県公式サイトが夏の県内お祭り・花火大会の日程一覧を公開。",
    ai_comment:
      "登録トピック「群馬イベント」の関連キーワード『お祭り』『地域イベント』に直接合致します。",
    related_topics: ["群馬イベント", "お祭り"],
    relevance_score: 90,
    created_at: "2026-06-30T09:30:00Z",
    updated_at: "2026-06-30T09:30:00Z",
  },
  {
    id: "feed-gunma-event-2",
    user_id: USER_ID,
    topic_id: "topic-gunma-event",
    source_id: "source-gunma-kankou",
    title: "秋の観光キャンペーン特設ページを公開",
    url: "https://gunma-dc.net/example-autumn-campaign",
    source_name: "ぐんま観光魅力プロモーション協議会",
    published_at: "2026-06-25T09:00:00Z",
    raw_excerpt:
      "紅葉シーズンに合わせた観光キャンペーンの特設ページを公開しました。対象施設の割引情報も...",
    summary:
      "ぐんま観光魅力プロモーション協議会が秋の観光キャンペーン特設ページを公開。対象施設の割引情報を掲載。",
    ai_comment: "「群馬県」の地域情報として関連度が高い記事です。",
    related_topics: ["群馬イベント"],
    relevance_score: 60,
    created_at: "2026-06-25T09:30:00Z",
    updated_at: "2026-06-25T09:30:00Z",
  },

  // --- YouTube制作 ---
  {
    id: "feed-youtube-1",
    user_id: USER_ID,
    topic_id: "topic-youtube-production",
    source_id: "source-youtube-creator-blog",
    title: "収益化ポリシーの一部変更について",
    url: "https://blog.youtube/example-monetization-policy-update",
    source_name: "YouTube公式クリエイターブログ",
    published_at: "2026-07-04T11:00:00Z",
    raw_excerpt:
      "パートナープログラムの収益化条件の一部が変更されます。詳細な適用時期と対象について...",
    summary:
      "YouTubeが収益化ポリシーを一部変更すると発表。パートナープログラムの適用条件が変わる。",
    ai_comment:
      "登録トピック「YouTube制作」の関連キーワード『YouTube運営』に直接影響する重要な公式情報です。",
    related_topics: ["YouTube制作", "YouTube運営"],
    relevance_score: 93,
    created_at: "2026-07-04T11:30:00Z",
    updated_at: "2026-07-04T11:30:00Z",
  },
  {
    id: "feed-youtube-2",
    user_id: USER_ID,
    topic_id: "topic-youtube-production",
    source_id: "source-video-edit-note",
    title: "初心者向け：ジャンプカットを自然に見せる編集テクニック",
    url: "https://video-edit-note.example.com/example-jump-cut",
    source_name: "動画編集ノート（技術ブログ）",
    published_at: "2026-06-18T09:00:00Z",
    raw_excerpt:
      "ジャンプカットが不自然に見えないためのカットタイミングとトランジションの選び方を解説します...",
    summary:
      "ジャンプカットを自然に見せるためのカットタイミングとトランジション選定のコツを解説した記事。",
    ai_comment: "「動画編集」の実践テクニックとして関連します。",
    related_topics: ["YouTube制作", "動画編集"],
    relevance_score: 55,
    created_at: "2026-06-18T09:30:00Z",
    updated_at: "2026-06-18T09:30:00Z",
  },
];
