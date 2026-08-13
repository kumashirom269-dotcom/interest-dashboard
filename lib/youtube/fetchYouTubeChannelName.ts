// YouTubeチャンネルページのHTMLからog:titleを取得し、チャンネル名を推定する（ベストエフォート）。
// YouTubeはHTML構造が変わりやすく、取得できないことも多いため、失敗時は必ずnullを返し、
// 呼び出し元（identifyTopicAction）が@handle等へフォールバックできるようにする。
// AI・外部有料APIは使用しない。1回の呼び出しにつき1回だけfetchする。

const FETCH_TIMEOUT_MS = 8000;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function fetchYouTubeChannelName(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InterestDashboardBot/1.0)",
      },
    });

    if (!res.ok) return null;

    const html = await res.text();
    const match =
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ??
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);

    if (!match) return null;

    const decoded = decodeHtmlEntities(match[1]).trim();
    return decoded || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
