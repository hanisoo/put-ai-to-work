"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArticleDTO } from "@/lib/types";
import { UNCATEGORIZED } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/source-labels";

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface Props {
  article: ArticleDTO;
  onSaved: (articleId: number, notionPageUrl: string) => void;
}

export default function NewsCard({ article, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ text: string; reconnect: boolean } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notion/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError({ text: body.error ?? `HTTP ${res.status}`, reconnect: Boolean(body.reconnect) });
        return;
      }
      onSaved(article.id, body.notionPageUrl);
    } catch (err) {
      setError({ text: err instanceof Error ? err.message : String(err), reconnect: false });
    } finally {
      setSaving(false);
    }
  }

  const showImage = article.imageUrl && !imageFailed;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {showImage && (
        // 외부 RSS 이미지 도메인이 다양해서 next/image 대신 img를 사용한다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl!}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="aspect-video w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{SOURCE_LABELS[article.source]}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{dateFormat.format(new Date(article.publishedAt))}</time>
          <span
            className={`ml-auto rounded-full px-2 py-0.5 font-medium ${
              article.categoryName ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            {article.categoryName ?? UNCATEGORIZED}
          </span>
        </div>

        <h2 className="text-base font-semibold leading-snug">{article.titleKo}</h2>
        <p className="flex-1 text-sm leading-relaxed text-slate-700">{article.summaryKo}</p>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            title={article.originalTitle}
            className="text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            원문 보기 ↗
          </a>
          <div className="ml-auto">
            {article.notionPageUrl ? (
              <a
                href={article.notionPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 hover:bg-emerald-100"
              >
                ✓ 저장됨 · Notion에서 열기
              </a>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
              >
                {saving && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                )}
                {saving ? "저장 중…" : "Notion 저장"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-600" role="alert">
            {error.text}{" "}
            {error.reconnect && (
              <Link href="/settings" className="font-medium underline">
                설정으로 이동
              </Link>
            )}
          </p>
        )}
      </div>
    </article>
  );
}
