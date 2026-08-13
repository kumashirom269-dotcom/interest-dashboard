// 検索API（Brave Search等）が返す日付表現を、Postgresのtimestamp with time zoneに
// 安全に保存できる形（ISO 8601文字列）またはnullに正規化する。
// Brave Search APIの"age"フィールドは"1 day ago"のような相対表現を返すことがあり、
// そのままpublished_atに入れるとinvalid input syntaxでinsert自体が失敗する。
//
// 方針（ユーザー指示の案B寄り）: 主要な"N unit(s) ago"パターンのみ機械的にISO変換し、
// それ以外（"1 day ago"のような曖昧な相対表現も含め、変換に自信が持てないもの）はnullにする。
// 元の文字列はraw_metadataに残すため、情報が失われるわけではない。

const RELATIVE_TIME_PATTERN =
  /^(\d+)\s*(hour|hours|day|days|week|weeks|month|months|year|years)\s+ago$/i;

const UNIT_MS: Record<string, number> = {
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  // month/yearは正確な暦計算ではなく概算（30日/365日）。
  // 「N month(s) ago」「N year(s) ago」はそもそも精度が粗い表現のため、
  // 概算で十分と判断している。
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

function parseRelativeTime(value: string): string | null {
  const match = value.match(RELATIVE_TIME_PATTERN);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase().replace(/s$/, "");
  const unitMs = UNIT_MS[unit];

  if (!Number.isFinite(amount) || !unitMs) return null;

  return new Date(Date.now() - amount * unitMs).toISOString();
}

export function normalizePublishedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const relative = parseRelativeTime(trimmed);
  if (relative) return relative;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
}
