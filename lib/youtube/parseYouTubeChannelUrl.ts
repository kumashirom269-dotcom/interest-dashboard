// YouTubeチャンネルを指すURLかどうかを判定し、種別（@handle / channel_id / c / user）を抽出する。
// 動画URL（/watch, youtu.be/VIDEO_ID等）はどのパターンにもマッチせずnullを返す
// （チャンネルURLとして確実に解釈できる場合のみ値を返す設計）。
export type YoutubeChannelUrlType = "handle" | "channel_id" | "c" | "user";

export interface ParsedYoutubeChannelUrl {
  type: YoutubeChannelUrlType;
  handle?: string;
  channelId?: string;
  canonicalUrl: string;
}

const ALLOWED_HOSTNAMES = ["youtube.com", "m.youtube.com", "youtu.be"];

export function parseYouTubeChannelUrl(input: string): ParsedYoutubeChannelUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, "");
  if (!ALLOWED_HOSTNAMES.includes(hostname)) return null;

  const pathname = url.pathname;

  const handleMatch = pathname.match(/^\/@([^/?#]+)/);
  if (handleMatch) {
    return {
      type: "handle",
      handle: handleMatch[1],
      canonicalUrl: `https://www.youtube.com/@${handleMatch[1]}`,
    };
  }

  const channelMatch = pathname.match(/^\/channel\/([^/?#]+)/);
  if (channelMatch) {
    return {
      type: "channel_id",
      channelId: channelMatch[1],
      canonicalUrl: `https://www.youtube.com/channel/${channelMatch[1]}`,
    };
  }

  const customMatch = pathname.match(/^\/(c|user)\/([^/?#]+)/);
  if (customMatch) {
    const type = customMatch[1] as "c" | "user";
    return {
      type,
      handle: customMatch[2],
      canonicalUrl: `https://www.youtube.com/${type}/${customMatch[2]}`,
    };
  }

  return null;
}

// 自由入力テキストの中からYouTubeらしきURLを抜き出し、チャンネルURLとして解析する。
// テキスト全体がURLのみの場合（想定される主な使い方）だけでなく、
// 文中にURLが含まれている場合も拾えるようにする。
const YOUTUBE_URL_PATTERN = /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/[^\s]+/i;

export function findYouTubeChannelUrlInText(text: string): ParsedYoutubeChannelUrl | null {
  const match = text.match(YOUTUBE_URL_PATTERN);
  if (!match) return null;
  return parseYouTubeChannelUrl(match[0]);
}

// 追加情報の履歴（複数ラウンド分）から、最も新しく入力されたYouTubeチャンネルURLを探す。
export function findYouTubeChannelUrlInHistory(
  additionalInfoHistory: string[],
): ParsedYoutubeChannelUrl | null {
  for (let i = additionalInfoHistory.length - 1; i >= 0; i -= 1) {
    const parsed = findYouTubeChannelUrlInText(additionalInfoHistory[i]);
    if (parsed) return parsed;
  }
  return null;
}

export function youtubeHandleLabel(parsed: ParsedYoutubeChannelUrl): string {
  if (parsed.type === "handle") return `@${parsed.handle}`;
  if (parsed.type === "channel_id") return parsed.channelId ?? parsed.canonicalUrl;
  return parsed.handle ?? parsed.canonicalUrl;
}
