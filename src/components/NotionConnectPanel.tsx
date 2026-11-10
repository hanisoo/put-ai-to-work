"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { NotionStatusDTO } from "@/lib/types";

export default function NotionConnectPanel() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<NotionStatusDTO | null>(null);
  const [parentInput, setParentInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(() => {
    const err = searchParams.get("notion_error");
    if (err) return { ok: false, text: `Notion 연결 실패: ${err}` };
    if (searchParams.get("notion") === "connected") return { ok: true, text: "Notion에 연결되었습니다." };
    return null;
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/notion/settings");
    if (res.ok) setStatus(await res.json());
  }, []);

  useEffect(() => {
    // 마운트 시 1회 연결 상태를 불러온다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleSaveParent(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/notion/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPage: parentInput }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setStatus(body);
      setParentInput("");
      setMessage({ ok: true, text: "상위 페이지를 저장했습니다." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}
        >
          {message.text}
        </p>
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">1. Notion 연결</h2>
          {status && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                status.connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
              }`}
            >
              {status.connected ? "연결됨" : "연결 안 됨"}
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Notion 원격 MCP 서버에 OAuth로 연결합니다. 한 번 연결하면 모든 사용자가 같은 연결을 함께 사용합니다.
        </p>
        {/* OAuth 리디렉션이므로 클라이언트 라우팅이 아닌 일반 링크로 이동한다. */}
        <a
          href="/api/notion/connect"
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          {status?.connected ? "다시 연결" : "Notion 연결"}
        </a>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">2. 저장할 상위 페이지</h2>
        <p className="text-sm text-slate-600">
          기사 페이지가 만들어질 Notion 페이지의 URL 또는 ID를 입력하세요.
        </p>
        <p className="text-sm">
          현재:{" "}
          {status?.parentPageId ? (
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{status.parentPageId}</code>
          ) : (
            <span className="text-slate-500">지정되지 않음</span>
          )}
        </p>
        <form onSubmit={handleSaveParent} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={parentInput}
            onChange={(e) => setParentInput(e.target.value)}
            placeholder="https://www.notion.so/내-페이지-1a2b3c..."
            required
            className="w-full flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </form>
      </section>
    </div>
  );
}
