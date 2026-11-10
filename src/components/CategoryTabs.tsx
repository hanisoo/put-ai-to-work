"use client";

import type { CategoryDTO } from "@/lib/types";
import { UNCATEGORIZED } from "@/lib/types";

export type TabValue = "all" | "uncategorized" | number;

interface Props {
  categories: CategoryDTO[];
  value: TabValue;
  onChange: (value: TabValue) => void;
}

export default function CategoryTabs({ categories, value, onChange }: Props) {
  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "전체" },
    ...categories.map((c) => ({ value: c.id as TabValue, label: c.name })),
    { value: "uncategorized", label: UNCATEGORIZED },
  ];

  return (
    <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={String(tab.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
