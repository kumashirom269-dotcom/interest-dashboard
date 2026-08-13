import Parser from "rss-parser";

export interface ParsedFeedItem {
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  raw_excerpt: string;
  image_url: string | null;
}

const parser = new Parser({ timeout: 10000 });

export async function fetchRssFeedItems(
  rssUrl: string,
): Promise<ParsedFeedItem[]> {
  const feed = await parser.parseURL(rssUrl);

  return (feed.items ?? [])
    .map((item): ParsedFeedItem => {
      const publishedAt =
        item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : null);

      return {
        title: item.title?.trim() || "(無題)",
        url: (item.link ?? "").trim(),
        summary: (item.contentSnippet ?? item.summary ?? "").trim(),
        published_at:
          publishedAt && !Number.isNaN(new Date(publishedAt).getTime())
            ? publishedAt
            : null,
        raw_excerpt: (item.content ?? item.contentSnippet ?? "").trim(),
        // RSSが<enclosure>で画像を提供している場合のみ採用する（追加のスクレイピングはしない）
        image_url:
          item.enclosure?.type?.startsWith("image/") && item.enclosure.url
            ? item.enclosure.url
            : null,
      };
    })
    .filter((item) => item.url.length > 0);
}
