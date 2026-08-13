import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16では `middleware.ts` は非推奨となり `proxy.ts` に名称変更されている。
// 挙動・シグネチャ（NextRequest/NextResponse）はmiddlewareと同じ。
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
