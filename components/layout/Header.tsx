"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/mypage", label: "マイページ" },
  { href: "/topics", label: "トピック管理" },
  { href: "/sources", label: "収集元管理" },
  { href: "/saved", label: "保存記事" },
  { href: "/settings", label: "設定" },
];

interface HeaderProps {
  userEmail?: string | null;
}

export function Header({ userEmail = null }: HeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3 sm:px-6">
        <Link href="/" className="text-base font-semibold text-slate-900">
          Antenna
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {userEmail ? (
            <>
              <span className="hidden text-slate-500 sm:inline">
                {userEmail}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={loggingOut}
                onClick={handleLogout}
              >
                ログアウト
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                ログイン
              </Link>
              <Link
                href="/signup"
                className="rounded-md px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                新規登録
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ナビゲーションは常に1行に収める。項目数が多い狭い画面でも折り返さず、
          収まりきらない場合のみ横スクロールにする（レビュー指摘: 以前は折り返しにより
          「設定」だけが孤立して2〜3行目に落ちていた）。 */}
      <nav className="mx-auto flex max-w-5xl flex-nowrap gap-1 overflow-x-auto px-4 py-2 text-sm sm:px-6 sm:text-sm [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:text-sm"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
