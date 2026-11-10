"use client";

import { useCallback, useEffect, useState } from "react";
import type { ArticleDTO, CategoryDTO } from "@/lib/types";
import CategoryTabs, { type TabValue } from "./CategoryTabs";
import FetchNewsButton from "./FetchNewsButton";
import NewsCard from "./NewsCard";

export default function NewsFeed() {
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [tab, setTab] = useState<TabValue>("all");
  const [articles, setArticles] = useState<ArticleDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  const loadArticles = useCallback(async (value: TabValue) => {
    setError(null);
    try {
      const res = await fetch(`/api/news?category=${value}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setArticles(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setArticles([]);
    }
  }, []);

  useEffect(() => {
    // 마운트 시 1회 카테고리 목록을 불러온다 (외부 데이터 동기화).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    // 탭이 바뀔 때마다 해당 카테고리 뉴스를 불러온다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadArticles(tab);
  }, [tab, loadArticles]);

  function handleSaved(articleId: number, notionPageUrl: string) {
    setArticles((prev) =>
      prev ? prev.map((a) => (a.id === articleId ? { ...a, notionPageUrl } : a)) : prev,
    );
  }

  function handleTabChange(value: TabValue) {
    setArticles(null);
    setTab(value);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">AI 뉴스</h1>
          <p className="mt-1 text-sm text-slate-500">TechCrunch · The Verge의 AI 소식을 한국어로 요약해 보여줍니다.</p>
        </div>
        <FetchNewsButton
          onDone={() => {
            void loadCategories();
            void loadArticles(tab);
          }}
        />
      </div>

      <CategoryTabs categories={categories} value={tab} onChange={handleTabChange} />

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {articles === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {tab === "all"
            ? "아직 가져온 뉴스가 없습니다. '뉴스 가져오기'를 눌러 보세요."
            : "이 카테고리에 해당하는 뉴스가 없습니다."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <NewsCard key={article.id} article={article} onSaved={handleSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
