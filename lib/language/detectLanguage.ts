export type ArticleLanguage = "ja" | "en" | "unknown";
export type PreferredLanguage = "ja" | "en";

const JAPANESE_CHAR_PATTERN = /[぀-ヿ一-鿿]/g;
const LATIN_CHAR_PATTERN = /[A-Za-z]/g;

// 簡易ヒューリスティックによる言語判定。
// 高精度な言語検出ライブラリは使わず、日本語文字（ひらがな・カタカナ・漢字）と
// ラテン文字の出現比率だけで ja / en / unknown を判定する。
export function detectArticleLanguage(text: string): ArticleLanguage {
  const stripped = text.replace(/<[^>]+>/g, " ");

  const japaneseCount = stripped.match(JAPANESE_CHAR_PATTERN)?.length ?? 0;
  const latinCount = stripped.match(LATIN_CHAR_PATTERN)?.length ?? 0;
  const totalSignal = japaneseCount + latinCount;

  if (totalSignal < 10) return "unknown";
  if (japaneseCount / totalSignal > 0.15) return "ja";
  if (latinCount / totalSignal > 0.5) return "en";
  return "unknown";
}

export function matchesPreferredLanguage(
  detected: ArticleLanguage,
  preferred: PreferredLanguage,
): boolean {
  return detected === preferred;
}
