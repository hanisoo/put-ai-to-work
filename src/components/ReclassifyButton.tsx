"use client";

import { useState } from "react";

export default function ReclassifyButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleClick() {
    if (!confirm("현재 카테고리 기준으로 모든 기사를 다시 분류할까요?")) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/news/reclassify", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const parts = [`전체 ${body.total}건 중 ${body.changed}건의 카테고리가 바뀌었습니다.`];
      if (body.failed > 0) {
        parts.push(`${body.failed}건은 분류하지 못해 그대로 두었습니다.`);
        for (const reason of body.failReasons ?? []) parts.push(`원인: ${reason}`);
      }
      setMessage({ ok: body.failed === 0, text: parts.join(" ") });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
        )}
        {loading ? "재분류 중…" : "재분류"}
      </button>
      {message && (
        <p className={`text-sm ${message.ok ? "text-emerald-700" : "text-red-600"}`} aria-live="polite">
          {message.text}
        </p>
      )}
    </div>
  );
}
