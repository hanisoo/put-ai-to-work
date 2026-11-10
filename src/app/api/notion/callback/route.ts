import { NextResponse, type NextRequest } from "next/server";
import { errorMessage, requireUser } from "@/lib/api";
import { appUrl, exchangeCode, type PendingAuth } from "@/lib/notion-oauth";

const OAUTH_COOKIE = "notion_oauth";

function backToSettings(params: Record<string, string>) {
  const url = new URL("/settings", appUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_COOKIE, "", { path: "/api/notion/callback", maxAge: 0 });
  return res;
}

export async function GET(request: NextRequest) {
  const { error } = await requireUser();
  if (error) return error;

  const params = request.nextUrl.searchParams;
  const oauthError = params.get("error");
  if (oauthError) {
    return backToSettings({
      notion_error: params.get("error_description") || oauthError,
    });
  }

  const code = params.get("code");
  const state = params.get("state");
  let pending: PendingAuth | null = null;
  try {
    pending = JSON.parse(request.cookies.get(OAUTH_COOKIE)?.value ?? "null");
  } catch {
    pending = null;
  }

  if (!code || !state || !pending || pending.state !== state) {
    return backToSettings({ notion_error: "인증 요청이 만료되었거나 올바르지 않습니다. 다시 연결해 주세요." });
  }

  try {
    await exchangeCode(code, pending.verifier);
    return backToSettings({ notion: "connected" });
  } catch (err) {
    console.error("[notion/callback]", err);
    return backToSettings({ notion_error: errorMessage(err) });
  }
}
