import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server Component / Server Action から呼び出すためのSupabaseクライアント。
// Server Componentからはcookieの書き込みができないため、setAllは失敗を握りつぶす
// （セッションの実際の更新はproxy.ts側で行われる前提）。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Componentから呼ばれた場合はここに来るが、
            // proxy.tsがセッションを更新するため無視してよい。
          }
        },
      },
    },
  );
}
