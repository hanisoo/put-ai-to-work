"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { CategoryDTO } from "@/lib/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";

export default function CategoryManager() {
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setCategories(await request<CategoryDTO[]>("/api/categories"));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    // 마운트 시 1회 카테고리 목록을 불러온다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      await request("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      setNewName("");
      setNewDesc("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAdding(false);
    }
  }

  function startEdit(c: CategoryDTO) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description);
    setError(null);
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setBusyId(editingId);
    setError(null);
    try {
      await request(`/api/categories/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, description: editDesc }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(c: CategoryDTO) {
    if (!confirm(`'${c.name}' 카테고리를 삭제할까요?\n이 카테고리의 뉴스는 '미분류'로 바뀝니다.`)) return;
    setBusyId(c.id);
    setError(null);
    try {
      await request(`/api/categories/${c.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="font-semibold">새 카테고리</h2>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <input
            className={inputClass}
            placeholder="이름 (예: 반도체/하드웨어)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={30}
            required
          />
          <input
            className={inputClass}
            placeholder="설명 — Claude가 분류할 때 힌트로 사용합니다"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            maxLength={300}
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {adding ? "추가 중…" : "추가"}
          </button>
        </div>
      </form>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {categories === null && <li className="p-4 text-sm text-slate-500">불러오는 중…</li>}
        {categories?.length === 0 && (
          <li className="p-4 text-sm text-slate-500">카테고리가 없습니다. 모든 뉴스가 &lsquo;미분류&rsquo;로 표시됩니다.</li>
        )}
        {categories?.map((c) =>
          editingId === c.id ? (
            <li key={c.id} className="p-4">
              <form onSubmit={handleUpdate} className="grid gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                <input
                  className={inputClass}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={30}
                  required
                  autoFocus
                />
                <input
                  className={inputClass}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={300}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busyId === c.id}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    취소
                  </button>
                </div>
              </form>
            </li>
          ) : (
            <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-slate-500">{c.description || "설명 없음"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(c)}
                  disabled={busyId === c.id}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  disabled={busyId === c.id}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  삭제
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
