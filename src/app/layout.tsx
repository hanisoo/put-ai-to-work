import { Suspense } from "react";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 뉴스 수집기",
  description: "해외 AI 뉴스를 한국어로 요약해 모아 보는 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ClerkProvider localization={koKR}>
          {/* 현재 경로(usePathname)는 요청 시점 값이라 정적 셸 밖에서 스트리밍한다. */}
          <Suspense fallback={<div className="h-14 border-b border-slate-200 bg-white" />}>
            <Header />
          </Suspense>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        </ClerkProvider>
      </body>
    </html>
  );
}
