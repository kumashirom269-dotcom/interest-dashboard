import type { SupabaseClient } from "@supabase/supabase-js";

// 一般公開に向けたレート制限（supabase/migrations/0048_rate_limit_events.sql参照）。
// サーバーレス環境ではインメモリカウンタがインスタンス間で共有できないため、DBに
// 呼び出しイベントを1行ずつ記録し、直近の行数を数える方式にする。
// service_role keyは使わず、既存のこのプロジェクトの方針（anon+RLS）のまま実装する
// （rate_limit_eventsはuser_id本人のみselect/insert可能なポリシーのため、
// この関数はログイン済みユーザーのSupabaseクライアントで呼び出す前提）。

export interface RateLimitWindow {
  // 集計対象の期間（ミリ秒）。
  windowMs: number;
  // この期間内に許容する最大件数。
  maxCount: number;
  // 制限に達した場合にユーザーへ表示する説明（例: "1時間あたり"）。
  label: string;
}

export interface RateLimitResult {
  allowed: boolean;
  // allowed=falseの場合、どのウィンドウで引っかかったかの説明文。
  message?: string;
}

// action・複数のウィンドウ（例: 1時間あたりN件 かつ 1日あたりM件）をまとめてチェックする。
// いずれかのウィンドウで上限に達していればallowed=falseを返し、イベントの記録もしない
// （制限に達した呼び出し自体はカウントに含めない。無駄なリトライで枠をさらに消費させないため）。
// 全ウィンドウを満たす場合のみ、新規イベントを1行insertしてallowed=trueを返す。
export async function checkAndRecordRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  windows: RateLimitWindow[],
): Promise<RateLimitResult> {
  for (const window of windows) {
    const sinceIso = new Date(Date.now() - window.windowMs).toISOString();
    const { count, error } = await supabase
      .from("rate_limit_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action", action)
      .gte("created_at", sinceIso);

    if (error) {
      // レート制限の集計自体が失敗した場合、機能停止よりは通す方を優先する
      // （このテーブルはコスト保護のための補助であり、可用性を犠牲にしてまで
      // 厳密に守るべき制約ではないため）。ただし呼び出し元でログ等に残せるよう、
      // エラーはthrowせずここで握りつぶす。
      continue;
    }

    if ((count ?? 0) >= window.maxCount) {
      return {
        allowed: false,
        message: `${window.label}の利用回数上限（${window.maxCount}回）に達しました。しばらく時間を置いてから再度お試しください。`,
      };
    }
  }

  // 記録自体が失敗しても（RLS設定漏れ等）、呼び出し元の処理は止めない。
  // 記録が失敗し続ける場合は次回以降のcheckも常にallowed=true寄りになるが、
  // 「保護が完全には機能しない」に留まり「正常な利用がブロックされる」よりは安全側。
  await supabase.from("rate_limit_events").insert({ user_id: userId, action }).then(
    () => undefined,
    () => undefined,
  );

  return { allowed: true };
}
