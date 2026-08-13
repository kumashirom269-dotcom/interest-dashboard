import type { WebPageFetchStatus } from "@/lib/research/types";

export interface WebPageExtract {
  url: string;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
  fetchedAt: string;
  fetchStatus: WebPageFetchStatus;
  errorMessage?: string;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_LENGTH = 500_000;
const MAX_TEXT_SNIPPET_LENGTH = 300;

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? decodeEntities(match[1].trim()) : null;
}

// name/property属性とcontent属性の順序（<meta name=".." content="..">とその逆）の
// どちらでも拾えるように、2パターン試す。
function extractMeta(html: string, attr: "name" | "property", key: string): string | null {
  const forward = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']*)["']`,
    "i",
  );
  const reversed = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${key}["']`,
    "i",
  );
  const match = html.match(forward) ?? html.match(reversed);
  return match ? decodeEntities(match[1].trim()) : null;
}

function extractCanonical(html: string): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  return match ? match[1].trim() : null;
}

function extractTextSnippet(html: string): string | null {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const stripped = body
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped ? stripped.slice(0, MAX_TEXT_SNIPPET_LENGTH) : null;
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
    // 簡易実装のため文字コード判定は行わずutf-8として読む
    // （discoverLinks.tsのdetectCharsetのような判定は今回のスコープ外。
    // 古い日本語サイトのshift_jis等では文字化けしうる残課題）。
    return new TextDecoder("utf-8").decode(truncated);
  } finally {
    clearTimeout(timeout);
  }
}

function categorizeError(e: unknown): string {
  if (e instanceof Error && e.name === "AbortError") return "タイムアウトしました";
  return e instanceof Error ? e.message : "ページ取得に失敗しました";
}

// 公式サイト候補・検索結果上位URLなど少数のページから、title・meta description・
// og:description・og:image・canonical URL・本文らしきテキストの冒頭を軽量に取得する。
// 本格的なスクレイピング・robots.txt対応・サイト負荷対策は今回のスコープ外。
// 呼び出し元で対象件数を絞り、必ずtry/catchで囲んで使うこと（失敗時はfetchStatus: "failed"を返す。
// 例外は投げない）。
export async function fetchWebPageSummary(url: string): Promise<WebPageExtract> {
  const fetchedAt = new Date().toISOString();

  try {
    const html = await fetchHtml(url);

    return {
      url,
      title: extractTitle(html),
      description: extractMeta(html, "name", "description") ?? extractMeta(html, "property", "og:description"),
      textSnippet: extractTextSnippet(html),
      imageUrl: extractMeta(html, "property", "og:image"),
      canonicalUrl: extractCanonical(html),
      fetchedAt,
      fetchStatus: "success",
    };
  } catch (e) {
    return {
      url,
      title: null,
      description: null,
      textSnippet: null,
      imageUrl: null,
      canonicalUrl: null,
      fetchedAt,
      fetchStatus: "failed",
      errorMessage: categorizeError(e),
    };
  }
}
