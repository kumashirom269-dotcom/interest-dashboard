import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PATH_PREFIXES = ["/mypage", "/topics", "/sources", "/saved"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// proxy.ts（Next.js 16でのmiddleware相当）から呼び出す、セッション更新と認証ガードの本体。
// Cookie経由のセッションだけを見る「楽観的チェック」であり、
// 実データへのアクセス保護は各Server Component/RLSで別途行う。
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // getUser()はCookie内のトークンをSupabaseサーバーへ問い合わせて検証する
  // （楽観的チェックより一段階厳格）。有効なCookieが送られてきているにも
  // かかわらずログイン画面へ押し戻される不具合の原因調査のため、失敗理由を
  // 一時的にログ出力する（実機検証用。原因特定後に削除する）。
  if (error) {
    console.error(
      `[proxy] getUser failed: name=${error.name} status=${error.status} message=${error.message} path=${request.nextUrl.pathname}`,
    );
  }

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
