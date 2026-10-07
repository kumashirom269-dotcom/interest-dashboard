import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PublicAntennaActions } from "@/components/public-antenna/PublicAntennaActions";
import { getPublicAntennaBySlug } from "@/lib/public-antenna/queries";
import { createClient } from "@/lib/supabase/server";

interface PublicAntennaPageProps {
  params: Promise<{ slug: string }>;
}

function formatDateTime(isoString: string | null): string {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: PublicAntennaPageProps): Promise<Metadata> {
  const { slug } = await params;
  const antenna = await getPublicAntennaBySlug(slug);

  if (!antenna) {
    return { title: "アンテナが見つかりません | Antenna" };
  }

  const title = `${antenna.title} | Antenna`;
  const description =
    antenna.description || `${antenna.title}についての最新情報を集めているアンテナです。`;

  return {
    title,
    description,
    // 情報が無いアンテナ（作成直後の空アンテナ等）は検索エンジンに大量indexさせない
    // （指示書15章の方針）。
    robots: antenna.cards.length === 0 ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Antenna",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function PublicAntennaPage({ params }: PublicAntennaPageProps) {
  const { slug } = await params;
  const antenna = await getPublicAntennaBySlug(slug);

  if (!antenna) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          ← Antenna トップへ
        </Link>

        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{antenna.title}</h1>
              {antenna.is_owner && <Badge tone="info">あなたのアンテナ</Badge>}
            </div>
            {antenna.description && (
              <p className="text-sm text-slate-600">{antenna.description}</p>
            )}
            <p className="text-xs text-slate-400">
              {antenna.follower_count}人がフォロー中
              {antenna.updated_at && ` ・ 最終更新 ${formatDateTime(antenna.updated_at)}`}
            </p>
          </div>

          <PublicAntennaActions
            slug={slug}
            topicId={antenna.id}
            isLoggedIn={Boolean(user)}
            isOwner={antenna.is_owner}
            initialIsFollowing={antenna.is_following}
          />
        </Card>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-slate-700">集めている情報</h2>
          {antenna.cards.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">
                まだ情報が集まっていません。しばらくしてからまた見に来てください。
              </p>
            </Card>
          ) : (
            antenna.cards.map((card) => (
              <Card key={card.id} className="flex gap-3">
                {card.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.image_url}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-sm font-semibold text-slate-900">{card.title}</h3>
                  <p className="line-clamp-2 text-xs text-slate-600">{card.summary}</p>
                  {card.source_names.length > 0 && (
                    <p className="truncate text-[11px] text-slate-400">
                      {card.source_names.join(" / ")}
                    </p>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        {antenna.sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-slate-700">情報源</h2>
            <div className="flex flex-wrap gap-1.5">
              {antenna.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge tone="neutral">{source.name}</Badge>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
