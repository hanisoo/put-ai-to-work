import "server-only";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** 로그인한 사용자 ID를 돌려주고, 없으면 401 응답을 돌려준다. */
export async function requireUser(): Promise<
  { userId: string; error: null } | { userId: null; error: NextResponse }
> {
  const { userId } = await auth();
  if (!userId) {
    return { userId: null, error: jsonError("로그인이 필요합니다.", 401) };
  }
  return { userId, error: null };
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
