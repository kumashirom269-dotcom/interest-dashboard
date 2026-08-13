import type { TopicEntityType } from "@/lib/topic-classification/types";

// トピックのentity_typeに応じたデフォルト画像。実在人物・実在店舗等の捏造画像は使わず、
// placehold.co の色分けされたプレースホルダーを使う（著作権・肖像権の問題がない）。
const CATEGORY_DEFAULT_IMAGES: Record<TopicEntityType, string> = {
  person: "https://placehold.co/128x128/1e293b/ffffff?text=Person",
  group: "https://placehold.co/128x128/7c3aed/ffffff?text=Group",
  artist: "https://placehold.co/128x128/9333ea/ffffff?text=Artist",
  sports_team: "https://placehold.co/128x128/059669/ffffff?text=Sports",
  place: "https://placehold.co/128x128/0d9488/ffffff?text=Place",
  company: "https://placehold.co/128x128/2563eb/ffffff?text=Company",
  product: "https://placehold.co/128x128/db2777/ffffff?text=Product",
  technology: "https://placehold.co/128x128/2563eb/ffffff?text=Tech",
  anime_manga_game: "https://placehold.co/128x128/dc2626/ffffff?text=Anime",
  food: "https://placehold.co/128x128/ea580c/ffffff?text=Food",
  lifestyle: "https://placehold.co/128x128/16a34a/ffffff?text=Life",
  local_topic: "https://placehold.co/128x128/0ea5e9/ffffff?text=Local",
  news_topic: "https://placehold.co/128x128/475569/ffffff?text=News",
  money: "https://placehold.co/128x128/ca8a04/ffffff?text=Money",
  health: "https://placehold.co/128x128/16a34a/ffffff?text=Health",
  education: "https://placehold.co/128x128/4338ca/ffffff?text=Edu",
  job: "https://placehold.co/128x128/64748b/ffffff?text=Job",
  event: "https://placehold.co/128x128/f59e0b/ffffff?text=Event",
  content_series: "https://placehold.co/128x128/be185d/ffffff?text=Series",
  community: "https://placehold.co/128x128/0891b2/ffffff?text=Community",
  unknown: "https://placehold.co/128x128/94a3b8/ffffff?text=Info",
};

// カード描画時（フォールバック）に使う汎用デフォルト画像。非同期処理を伴わない。
export const GENERIC_DEFAULT_IMAGE = CATEGORY_DEFAULT_IMAGES.unknown;

export function getCategoryDefaultImage(
  entityType: TopicEntityType | null | undefined,
): string {
  return CATEGORY_DEFAULT_IMAGES[entityType ?? "unknown"] ?? GENERIC_DEFAULT_IMAGE;
}

const OG_IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
];

// 元記事ページのOGP画像をベストエフォートで取得する。取得できなくても失敗扱いにはしない。
async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(articleUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const html = await res.text();
    for (const pattern of OG_IMAGE_PATTERNS) {
      const match = html.match(pattern);
      if (match?.[1]) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

// 画像の調達優先順位:
// 1. RSSに埋め込まれていた画像（既にfeed_items.image_urlにある場合はそれを使う）
// 2. 元記事のOGP画像（ベストエフォートでfetch。AI最適化バッチ実行時にのみ呼ばれる想定で、
//    記事一覧のレンダリング時には呼ばない）
// 3. トピックのentity_typeに応じたデフォルト画像
// AI画像生成は今回未実装（実在人物・実在店舗の捏造リスクがあるため、別途判断が必要）。
export async function resolveImageForFeedItem(
  existingImageUrl: string | null,
  articleUrl: string,
  entityType: TopicEntityType | null | undefined,
): Promise<string> {
  if (existingImageUrl) return existingImageUrl;

  const ogImage = await fetchOgImage(articleUrl);
  if (ogImage) return ogImage;

  return getCategoryDefaultImage(entityType);
}
