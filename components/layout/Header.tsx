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
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-base font-semibold text-slate-900">
          関心情報ダッシュボード
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
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
    </header>
  );
}
