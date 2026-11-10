"use client";

import { useState } from "react";
import type { FetchNewsResult } from "@/lib/types";
import { SOURCE_LABELS } from "@/lib/source-labels";

interface Props {
  onDone: () => void;
}

type Message = { kind: "ok" | "warn" | "error"; text: string };

export default function FetchNewsButton({ onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  async function handleClick() {
    setLoading(true);
    setMessages([]);
    try {
      const res = await fetch("/api/news/fetch", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);

      const result = body as FetchNewsResult;
      const next: Message[] = [
        {
          kind: "ok",
          text:
            result.added > 0
              ? `새 기사 ${result.added}건을 추가했습니다.`
              : "새로 추가된 기사가 없습니다.",
        },
      ];
      if (result.failed > 0) {
        next.push({
          kind: result.added === 0 ? "error" : "warn",
          text: `${result.failed}건은 처리하지 못했습니다. 다음에 '뉴스 가져오기'를 누르면 다시 시도합니다.`,
        });
        for (const reason of result.failReasons) {
          next.push({ kind: "error", text: `원인: ${reason}` });
        }
      }
      for (const e of result.feedErrors) {
        next.push({
          kind: "warn",
          text: `${SOURCE_LABELS[e.source]} 피드를 불러오지 못했습니다: ${e.message}`,
        });
      }
      setMessages(next);
      onDone();
    } catch (err) {
      setMessages([{ kind: "error", text: err instanceof Error ? err.message : String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {loading ? "가져오는 중… (번역·요약 진행)" : "뉴스 가져오기"}
      </button>
      {messages.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.kind === "ok"
                  ? "text-emerald-700"
                  : m.kind === "warn"
                    ? "text-amber-700"
                    : "text-red-600"
              }
            >
              {m.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
