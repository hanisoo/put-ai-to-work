import { Suspense } from "react";
import NotionConnectPanel from "@/components/NotionConnectPanel";

export const metadata = { title: "설정 · AI 뉴스 수집기" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">설정</h1>
        <p className="mt-1 text-sm text-slate-500">마음에 드는 뉴스를 Notion에 저장하기 위한 설정입니다.</p>
      </div>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-200/70" />}>
        <NotionConnectPanel />
      </Suspense>
    </div>
  );
}
