"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  copyPublicAntenna,
  followTopic,
  unfollowTopic,
} from "@/app/(app)/topics/actions";

interface PublicAntennaActionsProps {
  slug: string;
  topicId: string;
  isLoggedIn: boolean;
  isOwner: boolean;
  initialIsFollowing: boolean;
}

// 公開アンテナページの「フォローする」「自分用にコピー」「シェア」ボタン。
// 未ログインの場合はサーバーアクションを呼ばず、/login?next=/a/[slug]へ誘導する
// （lib/auth/safeNextPath.ts参照）。自分自身のアンテナにはフォロー/コピーの
// ボタン自体を出さない。
export function PublicAntennaActions({
  slug,
  topicId,
  isLoggedIn,
  isOwner,
  initialIsFollowing,
}: PublicAntennaActionsProps) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [isCopyPending, setIsCopyPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  const nextPath = `/a/${slug}`;

  function requireLogin() {
    router.push(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  // ページ表示時はログイン済みでも、操作時にはセッション切れになっている場合が
  // ある（指示書22章「session切れ」）。その場合は技術的なエラー文をそのまま
  // 見せず、ログイン画面へ誘導する。
  function handleActionError(e: unknown, fallbackMessage: string) {
    if (e instanceof Error && e.message === "Unauthorized") {
      requireLogin();
      return;
    }
    setErrorMessage(e instanceof Error ? e.message : fallbackMessage);
  }

  async function handleFollowToggle() {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    setErrorMessage(null);
    setIsFollowPending(true);
    try {
      if (isFollowing) {
        await unfollowTopic(topicId);
        setIsFollowing(false);
      } else {
        await followTopic(topicId);
        setIsFollowing(true);
      }
    } catch (e) {
      handleActionError(e, "操作に失敗しました。もう一度お試しください。");
    } finally {
      setIsFollowPending(false);
    }
  }

  async function handleCopy() {
    if (!isLoggedIn) {
      requireLogin();
      return;
    }
    setErrorMessage(null);
    setIsCopyPending(true);
    try {
      const newTopic = await copyPublicAntenna(slug);
      router.push(`/topics?copied=${newTopic.id}`);
    } catch (e) {
      handleActionError(e, "コピーに失敗しました。もう一度お試しください。");
      setIsCopyPending(false);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    try {
      if (nav?.share) {
        await nav.share({ url });
        return;
      }
      await nav?.clipboard?.writeText(url);
      setShareMessage("URLをコピーしました");
      setTimeout(() => setShareMessage(null), 2000);
    } catch {
      // ユーザーによる共有キャンセル等は無視する
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {!isOwner && (
          <Button
            variant={isFollowing ? "secondary" : "primary"}
            disabled={isFollowPending}
            onClick={handleFollowToggle}
          >
            {isFollowPending ? "処理中..." : isFollowing ? "フォロー中" : "フォローする"}
          </Button>
        )}
        {!isOwner && (
          <Button variant="secondary" disabled={isCopyPending} onClick={handleCopy}>
            {isCopyPending ? "コピー中..." : "自分用にコピー"}
          </Button>
        )}
        <Button variant="ghost" onClick={handleShare}>
          シェア
        </Button>
      </div>
      {shareMessage && <p className="text-xs text-emerald-600">{shareMessage}</p>}
      {errorMessage && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
