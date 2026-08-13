// YouTubeチャンネルのRSS URLは https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx の形式が必要。
// channel_idがURL中に確実に含まれている場合（/channel/UCxxxx/形式）のみ、決定的に変換する。
// /user/、/@handle、/c/customname形式はchannel_idを含まないため、
// YouTube Data API等の追加API呼び出しなしには正しいchannel_idを特定できない
// （このアプリでは課金を伴うAPI導入を勝手に行わない方針のため、これらは変換せずnullを返す）。
export function normalizeYoutubeRssUrl(url: string): string | null {
  if (!url) return null;

  const alreadyFeedUrl = url.match(
    /youtube\.com\/feeds\/videos\.xml\?(?:channel_id|playlist_id)=([a-zA-Z0-9_-]+)/,
  );
  if (alreadyFeedUrl) return url;

  const channelIdMatch = url.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
  if (channelIdMatch) {
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`;
  }

  return null;
}
