"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";

const NAV = [
  { href: "/", label: "뉴스" },
  { href: "/categories", label: "카테고리" },
  { href: "/settings", label: "설정" },
] as const;

export default function Header() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="shrink-0 text-base font-bold tracking-tight">
          AI 뉴스 수집기
        </Link>
        {isSignedIn && (
          <>
            <nav className="flex min-w-0 flex-1 gap-1 overflow-x-auto text-sm">
              {NAV.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-md px-3 py-1.5 transition-colors ${
                      active
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <UserButton />
          </>
        )}
      </div>
    </header>
  );
}
