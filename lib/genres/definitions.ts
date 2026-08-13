import type { GenreDefinition } from "@/lib/genres/types";

// 確定33ジャンル（仕様書「ClaudeCode_33ジャンル統合エンジン実装プロンプト_完全版.md」第1章準拠）。
// genreIdは変更に強い永続的な文字列。genreNumberは表示順・設計資料上の番号でしかなく、
// DB上の永続IDとしては使わない。
export const GENRE_DEFINITIONS: GenreDefinition[] = [
  { genreId: "music", genreNumber: 1, displayName: "音楽", aliases: ["音楽", "ミュージック"], configurationVersion: 1, isActive: true },
  { genreId: "movie", genreNumber: 2, displayName: "映画", aliases: ["映画", "シネマ"], configurationVersion: 1, isActive: true },
  { genreId: "tv_drama", genreNumber: 3, displayName: "テレビ・ドラマ", aliases: ["テレビ", "ドラマ", "TV"], configurationVersion: 1, isActive: true },
  { genreId: "anime", genreNumber: 4, displayName: "アニメ", aliases: ["アニメ"], configurationVersion: 1, isActive: true },
  { genreId: "manga_comic", genreNumber: 5, displayName: "漫画・コミック", aliases: ["漫画", "コミック", "マンガ"], configurationVersion: 1, isActive: true },
  { genreId: "book_reading", genreNumber: 6, displayName: "書籍・読書", aliases: ["書籍", "読書", "本"], configurationVersion: 1, isActive: true },
  { genreId: "game", genreNumber: 7, displayName: "ゲーム", aliases: ["ゲーム", "eスポーツ"], configurationVersion: 1, isActive: true },
  { genreId: "celebrity_talent", genreNumber: 8, displayName: "芸能人・タレント", aliases: ["芸能人", "タレント", "俳優"], configurationVersion: 1, isActive: true },
  { genreId: "vtuber_streamer", genreNumber: 9, displayName: "VTuber・動画配信者", aliases: ["VTuber", "YouTuber", "配信者", "ストリーマー"], configurationVersion: 1, isActive: true },
  { genreId: "comedy_variety", genreNumber: 10, displayName: "お笑い・バラエティ", aliases: ["お笑い", "バラエティ", "芸人"], configurationVersion: 1, isActive: true },
  { genreId: "stage_theater", genreNumber: 11, displayName: "舞台・演劇", aliases: ["舞台", "演劇", "ミュージカル"], configurationVersion: 1, isActive: true },
  { genreId: "sports_watching", genreNumber: 12, displayName: "スポーツ観戦", aliases: ["スポーツ観戦", "試合観戦"], configurationVersion: 1, isActive: true },
  { genreId: "sports_fitness", genreNumber: 13, displayName: "スポーツ・運動実践", aliases: ["運動", "フィットネス", "トレーニング"], configurationVersion: 1, isActive: true },
  { genreId: "outdoor", genreNumber: 14, displayName: "アウトドア", aliases: ["アウトドア", "キャンプ", "登山"], configurationVersion: 1, isActive: true },
  { genreId: "travel", genreNumber: 15, displayName: "旅行・観光", aliases: ["旅行", "観光"], configurationVersion: 1, isActive: true },
  { genreId: "theme_park_leisure", genreNumber: 16, displayName: "テーマパーク・レジャー施設", aliases: ["テーマパーク", "遊園地", "水族館", "動物園"], configurationVersion: 1, isActive: true },
  { genreId: "gourmet_dining", genreNumber: 17, displayName: "グルメ・飲食", aliases: ["グルメ", "飲食店", "スイーツ"], configurationVersion: 1, isActive: true },
  { genreId: "cooking_baking", genreNumber: 18, displayName: "料理・お菓子作り", aliases: ["料理", "レシピ", "お菓子作り"], configurationVersion: 1, isActive: true },
  { genreId: "fashion_beauty", genreNumber: 19, displayName: "ファッション・美容", aliases: ["ファッション", "美容", "コスメ"], configurationVersion: 1, isActive: true },
  { genreId: "art_photo_creation", genreNumber: 20, displayName: "アート・写真・創作", aliases: ["アート", "写真", "イラスト"], configurationVersion: 1, isActive: true },
  { genreId: "handmade_diy", genreNumber: 21, displayName: "ハンドメイド・DIY", aliases: ["ハンドメイド", "DIY"], configurationVersion: 1, isActive: true },
  { genreId: "vehicles", genreNumber: 22, displayName: "乗り物", aliases: ["乗り物", "鉄道", "自動車", "バイク"], configurationVersion: 1, isActive: true },
  { genreId: "plants_nature", genreNumber: 23, displayName: "植物・自然", aliases: ["植物", "園芸", "自然観察"], configurationVersion: 1, isActive: true },
  { genreId: "history_culture", genreNumber: 24, displayName: "歴史・文化", aliases: ["歴史", "文化財", "考古学"], configurationVersion: 1, isActive: true },
  { genreId: "indoor_hobby_collection", genreNumber: 25, displayName: "ゲーム以外の室内趣味・コレクション", aliases: ["模型", "コレクション", "プラモデル"], configurationVersion: 1, isActive: true },
  { genreId: "radio_podcast", genreNumber: 26, displayName: "ラジオ・Podcast", aliases: ["ラジオ", "Podcast"], configurationVersion: 1, isActive: true },
  { genreId: "tabletop_games", genreNumber: 27, displayName: "ボードゲーム・カードゲーム・テーブルゲーム", aliases: ["ボードゲーム", "カードゲーム", "TRPG"], configurationVersion: 1, isActive: true },
  { genreId: "idol_fan_activity", genreNumber: 28, displayName: "アイドル・ファン活動", aliases: ["アイドル", "推し活", "ファンクラブ"], configurationVersion: 1, isActive: true },
  { genreId: "character_toys", genreNumber: 29, displayName: "キャラクター・玩具", aliases: ["キャラクター", "玩具", "フィギュア"], configurationVersion: 1, isActive: true },
  { genreId: "stationery_planner", genreNumber: 30, displayName: "文房具・手帳", aliases: ["文房具", "手帳", "万年筆"], configurationVersion: 1, isActive: true },
  { genreId: "gadgets_digital", genreNumber: 31, displayName: "ガジェット・デジタル機器", aliases: ["ガジェット", "スマホ", "PC", "家電"], configurationVersion: 1, isActive: true },
  { genreId: "pets_animals", genreNumber: 32, displayName: "ペット・動物・生き物", aliases: ["ペット", "動物", "犬", "猫"], configurationVersion: 1, isActive: true },
  { genreId: "local_events_festivals", genreNumber: 33, displayName: "地域イベント・祭り", aliases: ["地域イベント", "祭り", "マルシェ"], configurationVersion: 1, isActive: true },
];

export const GENRE_IDS: string[] = GENRE_DEFINITIONS.map((g) => g.genreId);

const GENRE_BY_ID = new Map(GENRE_DEFINITIONS.map((g) => [g.genreId, g]));

export function getGenreDefinition(genreId: string): GenreDefinition | undefined {
  return GENRE_BY_ID.get(genreId);
}

export function isValidGenreId(value: string): boolean {
  return GENRE_BY_ID.has(value);
}
