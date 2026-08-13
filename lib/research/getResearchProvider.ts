import type { ResearchProvider } from "./types";
import { MockResearchProvider } from "./providers/MockResearchProvider";
import { WebSearchApiProvider } from "./providers/WebSearchApiProvider";

export type ResearchProviderMode = "mock" | "real";

export interface ResolvedResearchProvider {
  provider: ResearchProvider;
  mode: ResearchProviderMode;
  missingApiKey: boolean;
}

// .env.local に BRAVE_SEARCH_API_KEY が設定されている場合のみ実際の検索APIを使い、
// 未設定の場合は必ずMockResearchProviderにフォールバックする。
// これにより、APIキーの有無に関わらずアプリ全体が壊れない
// （値そのものは一切ログ・表示しない。存在確認のみ行う）。
// mode/missingApiKeyは、開発者・ユーザー向けに「なぜモックで動いているか」を
// 表示するためのメタ情報として呼び出し元に返す。
export function resolveResearchProvider(): ResolvedResearchProvider {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (apiKey) {
    return { provider: new WebSearchApiProvider(apiKey), mode: "real", missingApiKey: false };
  }
  return { provider: new MockResearchProvider(), mode: "mock", missingApiKey: true };
}

// providerだけが必要な既存の呼び出し元向けの簡易ヘルパー。
export function getResearchProvider(): ResearchProvider {
  return resolveResearchProvider().provider;
}

// APIキーを実際に読まずに設定有無だけを確認したい場所（UI等）向け。
export function isResearchApiKeyConfigured(): boolean {
  return Boolean(process.env.BRAVE_SEARCH_API_KEY);
}
