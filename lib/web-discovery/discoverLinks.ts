import { DISCOVERY_KEYWORDS } from "./keywords";

export type WebDiscoveryStatus = "success" | "failed" | "skipped";

export type WebDiscoveryErrorType =
  | "http_error"
  | "timeout"
  | "fetch_failed"
  | "no_html"
  | "skipped_ineligible"
  | "unknown";

export interface DiscoveredLink {
  title: string;
  url: string;
  matchedKeyword: string;
  score: number;
}

export interface WebDiscoveryResult {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  status: WebDiscoveryStatus;
  discoveredLinks: DiscoveredLink[];
  errorType?: WebDiscoveryErrorType;
  errorMessage?: string;
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_LENGTH = 2_000_000;
const MAX_CANDIDATES = 10;

const ANCHOR_REGEX = /<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

function categorizeDiscoveryError(error: unknown): {
  errorType: WebDiscoveryErrorType;
  errorMessage: string;
} {
  if (error instanceof Error && error.name === "AbortError") {
    return { errorType: "timeout", errorMessage: "タイムアウトしました" };
  }

  const message = error instanceof Error ? error.message : "HTML取得に失敗しました";
  const statusMatch = message.match(/Status code (\d+)/i);
  if (statusMatch) {
    return { errorType: "http_error", errorMessage: `HTTP ${statusMatch[1]} エラー` };
  }

  return { errorType: "fetch_failed", errorMessage: message };
}

// shift-jis/sjis等の表記ゆれをTextDecoderが理解できる名前に正規化する
function normalizeCharsetName(charset: string): string {
  const lower = charset.trim().toLowerCase();
  if (lower === "shift-jis" || lower === "sjis" || lower === "x-sjis") {
    return "shift_jis";
  }
  return lower;
}

// 文字コードをHTTPヘッダー→HTML先頭のmetaタグの順で判定する（日本語の古いサイトに
// 多いshift_jis等をutf-8決め打ちで読むと文字化けするため）。
function detectCharset(contentTypeHeader: string, buffer: ArrayBuffer): string {
  const headerMatch = contentTypeHeader.match(/charset=([^;]+)/i);
  if (headerMatch) return normalizeCharsetName(headerMatch[1]);

  const sniff = new TextDecoder("latin1").decode(buffer.slice(0, 2048));
  const metaMatch = sniff.match(/<meta[^>]+charset=["']?([a-zA-Z0-9_-]+)/i);
  if (metaMatch) return normalizeCharsetName(metaMatch[1]);

  return "utf-8";
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InterestDashboardBot/1.0)",
      },
    });

    if (!res.ok) {
      throw new Error(`Status code ${res.status}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new Error(`Unexpected content-type: ${contentType || "unknown"}`);
    }

    const buffer = await res.arrayBuffer();
    const truncated = buffer.slice(0, MAX_HTML_LENGTH);
    const charset = detectCharset(contentType, truncated);

    try {
      return new TextDecoder(charset).decode(truncated);
    } catch {
      // 未知・未対応のエンコーディング名の場合はutf-8にフォールバックする
      return new TextDecoder("utf-8").decode(truncated);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// リンクのURLパス・表示テキストの両方からキーワード一致を探す。
// URLパス側での一致は表示テキストのみの一致より信頼度が高いとみなし、加点する。
function scoreLink(
  urlPath: string,
  text: string,
): { matchedKeyword: string; score: number } | null {
  const lowerPath = urlPath.toLowerCase();
  const lowerText = text.toLowerCase();

  let matchedKeyword: string | null = null;
  let matchCount = 0;
  let matchedInUrl = false;

  for (const keyword of DISCOVERY_KEYWORDS) {
    const lowerKeyword = keyword.toLowerCase();
    const inUrl = lowerPath.includes(lowerKeyword);
    const inText = lowerText.includes(lowerKeyword);
    if (inUrl || inText) {
      matchCount += 1;
      if (!matchedKeyword) matchedKeyword = keyword;
      if (inUrl) matchedInUrl = true;
    }
  }

  if (!matchedKeyword) return null;

  const score = Math.min(100, matchCount * 10 + (matchedInUrl ? 5 : 0));
  return { matchedKeyword, score };
}

export function extractDiscoveredLinks(
  html: string,
  baseUrl: string,
): DiscoveredLink[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const candidates: DiscoveredLink[] = [];

  for (const match of html.matchAll(ANCHOR_REGEX)) {
    const rawHref = match[1]?.trim();
    const rawText = stripTags(match[2] ?? "");
    if (!rawHref) continue;
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) continue;

    let resolved: URL;
    try {
      resolved = new URL(rawHref, base);
    } catch {
      continue;
    }

    // 同一サイト内のリンクのみを対象にする（外部SNSリンク等の誤検出を避ける）
    if (resolved.hostname !== base.hostname) continue;

    const absoluteUrl = resolved.toString();
    if (seen.has(absoluteUrl)) continue;

    const result = scoreLink(resolved.pathname, rawText);
    if (!result) continue;

    seen.add(absoluteUrl);
    candidates.push({
      title: rawText || absoluteUrl,
      url: absoluteUrl,
      matchedKeyword: result.matchedKeyword,
      score: result.score,
    });
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
}

// source 1件分のWeb探索を行う。DBへの保存は一切行わない（呼び出し元に結果を返すのみ）。
export async function discoverLinksForUrl(
  sourceId: string,
  sourceName: string,
  sourceUrl: string,
): Promise<WebDiscoveryResult> {
  try {
    const html = await fetchHtml(sourceUrl);
    const discoveredLinks = extractDiscoveredLinks(html, sourceUrl);

    return {
      sourceId,
      sourceName,
      sourceUrl,
      status: "success",
      discoveredLinks,
    };
  } catch (e) {
    const { errorType, errorMessage } = categorizeDiscoveryError(e);
    return {
      sourceId,
      sourceName,
      sourceUrl,
      status: "failed",
      discoveredLinks: [],
      errorType,
      errorMessage,
    };
  }
}
