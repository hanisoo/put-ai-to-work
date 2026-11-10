import { NextResponse } from "next/server";
import { errorMessage, requireUser } from "@/lib/api";
import { appUrl, buildAuthorizationUrl } from "@/lib/notion-oauth";

const OAUTH_COOKIE = "notion_oauth";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  try {
    const { url, pending } = await buildAuthorizationUrl();
    const res = NextResponse.redirect(url);
    // PKCE verifier와 state는 콜백에서만 쓰도록 httpOnly 쿠키에 잠깐 보관한다.
    res.cookies.set(OAUTH_COOKIE, JSON.stringify(pending), {
      httpOnly: true,
      secure: appUrl().startsWith("https://"),
      sameSite: "lax",
      path: "/api/notion/callback",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    console.error("[notion/connect]", err);
    const back = new URL("/settings", appUrl());
    back.searchParams.set("notion_error", errorMessage(err));
    return NextResponse.redirect(back);
  }
}
